/**
 * Usage:
 *   npm run send-webhook -- <orderId> <amountPaise> [eventId] [status]
 *
 * Sends a correctly-signed webhook to the running backend so you can
 * exercise the payment flow without a real provider.
 */
import 'dotenv/config';
import { createHmac } from 'crypto';

const [, , orderId, amountArg, eventArg, statusArg] = process.argv;
if (!orderId || !amountArg) {
  // eslint-disable-next-line no-console
  console.error(
    'usage: npm run send-webhook -- <orderId> <amountPaise> [eventId] [status]',
  );
  process.exit(1);
}

const amountPaise = Number(amountArg);
if (!Number.isInteger(amountPaise) || amountPaise < 0) {
  // eslint-disable-next-line no-console
  console.error('amountPaise must be a non-negative integer');
  process.exit(1);
}

const eventId = eventArg ?? `evt_${Date.now()}`;
const status = statusArg ?? 'captured';
const secret = process.env.WEBHOOK_SECRET ?? 'dev-secret-change-me';
const base = process.env.API_BASE ?? 'http://localhost:3000';

const payload = JSON.stringify({ eventId, orderId, amountPaise, status });
const signature = createHmac('sha256', secret).update(payload).digest('hex');

(async () => {
  const res = await fetch(`${base}/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
    },
    body: payload,
  });
  // eslint-disable-next-line no-console
  console.log(res.status, await res.text());
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});