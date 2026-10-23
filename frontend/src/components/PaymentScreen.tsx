import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, formatPaise, type OrderView } from '../api';
import { useServerClock } from '../useServerClock';

type Props = {
  initial: OrderView;
  onDone: (final: OrderView) => void;
};

// We ONLY exit this screen when the order is picked up, expired, or needs review.
// If it becomes 'paid', we stay here to show the success UI and the pickup button.
const TERMINAL: OrderView['status'][] = ['picked_up', 'expired', 'needs_review'];

const POLL_MS = 1500;

export function PaymentScreen({ initial, onDone }: Props) {
  const [order, setOrder] = useState<OrderView>(initial);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [, setTick] = useState(0); // forces a re-render every second for a smooth countdown

  const { sync, secondsUntil } = useServerClock();
  const stopped = useRef(false);

  // Keep the latest callbacks in refs so the polling effect depends ONLY on the
  // order id. This prevents the timer from being torn down on every re-render.
  const onDoneRef = useRef(onDone);
  const syncRef = useRef(sync);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  // Total hold duration, captured once, so the progress bar has a stable denominator.
  const totalSeconds = useRef(Math.max(initial.expiresInSeconds || 120, 1)).current;

  // Seed the clock offset and handle an already-terminal initial order.
  useEffect(() => {
    syncRef.current(initial.serverNow);
    if (TERMINAL.includes(initial.status)) {
      stopped.current = true;
      onDoneRef.current(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render once a second so the countdown doesn't skip between polls.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Poll until the order reaches a terminal state.
  useEffect(() => {
    stopped.current = false;
    let timer: number | undefined;

    const tick = async () => {
      if (stopped.current) return;
      try {
        const fresh = await api.getOrder(initial.orderId);
        if (stopped.current) return; // unmounted / already exited while in flight

        syncRef.current(fresh.serverNow); // keep clock honest each poll
        setOrder(fresh);

        if (TERMINAL.includes(fresh.status)) {
          stopped.current = true;
          onDoneRef.current(fresh);
          return;
        }
      } catch (err) {
        // Transient network error: log and try again next tick.
        console.warn('poll failed', err);
      }

      if (!stopped.current) {
        timer = window.setTimeout(tick, POLL_MS);
      }
    };

    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      stopped.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [initial.orderId]);

  const secondsLeft = Math.max(0, Math.ceil(secondsUntil(order.expiresAt)));
  const isPaid = order.status === 'paid';
  const isPaidOrDone = isPaid || order.status === 'picked_up';

  const statusCopy = useMemo(() => {
    switch (order.status) {
      case 'pending':
        return secondsLeft > 0
          ? 'Waiting for payment…'
          : 'Hold expired. If your payment went through, we will mark it paid once the provider tells us.';
      case 'paid':
        return 'Payment received. Ready for pickup.';
      case 'picked_up':
        return 'Picked up. Enjoy!';
      case 'expired':
        return 'Hold expired. Nothing was charged.';
      case 'needs_review':
        return 'We need a human to look at this payment. Please ask the attendant.';
      default:
        return '';
    }
  }, [order.status, secondsLeft]);

  // Progress bar: forced to 100% once paid.
  const barPct = isPaidOrDone
    ? 100
    : Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));

  const handleClaim = useCallback(async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimError(null);

    try {
      await api.claimPickup(order.orderId);
      const fresh = await api.getOrder(order.orderId);
      stopped.current = true;
      onDoneRef.current(fresh);
    } catch (err) {
      console.warn('claim failed', err);
      // The claim may have lost a race (e.g. already claimed). Re-check the real state.
      try {
        const fresh = await api.getOrder(order.orderId);
        setOrder(fresh);
        if (TERMINAL.includes(fresh.status)) {
          stopped.current = true;
          onDoneRef.current(fresh);
          return;
        }
      } catch {
        /* ignore; show the error below */
      }
      setClaimError('Could not unlock the locker. Please try again.');
      setClaiming(false);
    }
  }, [claiming, order.orderId]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-xl border border-snack-edge bg-snack-panel p-6">
      <h2 className="text-xl font-semibold">
        {isPaid ? 'Order Confirmed' : `Pay ${formatPaise(order.totalPaise)} via UPI`}
      </h2>

      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-snack-muted">
            {isPaidOrDone ? 'Payment Status' : 'Hold expires in'}
          </span>
          <span
            className={`font-mono tabular-nums ${isPaidOrDone ? 'text-snack-good' : ''}`}
          >
            {isPaidOrDone ? 'Paid' : formatClock(secondsLeft)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-snack-edge">
          <div
            className={`h-full transition-[width] duration-500 ${
              isPaidOrDone || secondsLeft >= 20 ? 'bg-snack-good' : 'bg-snack-bad'
            }`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      <p className="text-sm text-snack-muted" aria-live="polite">
        {statusCopy}
      </p>

      <div className="rounded-md border border-snack-edge bg-black/30 p-3">
        <div className="text-sm text-snack-muted">Order ID</div>
        <div className="break-all font-mono text-xs">{order.orderId}</div>
      </div>

      {/* Only show the CLI hint while we are still waiting and the timer hasn't hit 0 */}
      {order.status === 'pending' && secondsLeft > 0 && (
        <p className="text-xs text-snack-muted">
          In a real deployment this screen would show a UPI QR. Here, run{' '}
          <code className="rounded bg-black/40 px-1">
            npm run send-webhook -- {order.orderId} {order.totalPaise}
          </code>{' '}
          to simulate payment.
        </p>
      )}

      {/* Pickup button only when paid */}
      {isPaid && (
        <div className="mt-2 flex flex-col gap-3">
          <div className="rounded-md border border-snack-good/30 bg-snack-good/10 p-3 text-center text-sm font-medium text-snack-good">
            Payment successful! You can now collect your order.
          </div>

          {claimError && (
            <p className="text-center text-sm text-snack-bad" role="alert">
              {claimError}
            </p>
          )}

          <button
            className="rounded-md bg-snack-accent px-4 py-2 font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? 'Unlocking…' : 'Simulate locker pickup'}
          </button>
        </div>
      )}
    </div>
  );
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
