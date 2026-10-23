import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, formatPaise, type OrderView, type Product } from './api';
import { ProductShelf } from './components/ProductShelf';
import { CartPanel, type CartLine } from './components/CartPanel';
import { PaymentScreen } from './components/PaymentScreen';
import { useServerClock } from './useServerClock';

type Screen =
  | { kind: 'shop' }
  | { kind: 'pay'; order: OrderView }
  | { kind: 'done'; order: OrderView };

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [screen, setScreen] = useState<Screen>({ kind: 'shop' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sync } = useServerClock();

  const refreshProducts = useCallback(async () => {
    try {
      const list = await api.listProducts();
      setProducts(list);
    } catch {
      setError('Could not load products.');
    }
  }, []);

  useEffect(() => {
    void refreshProducts();
    const id = setInterval(refreshProducts, 4000);
    return () => clearInterval(id);
  }, [refreshProducts]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selectedIds = useMemo(() => new Set(lines.map((l) => l.productId)), [lines]);

  function toggleProduct(id: string) {
    setLines((curr) => {
      const exists = curr.find((l) => l.productId === id);
      if (exists) return curr.filter((l) => l.productId !== id);
      return [...curr, { productId: id, quantity: 1 }];
    });
  }

  function setQty(productId: string, qty: number) {
    setLines((curr) => {
      if (qty <= 0) return curr.filter((l) => l.productId !== productId);
      return curr.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l));
    });
  }

  async function placeOrder() {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createOrder(lines);
      // The created order already carries serverNow + expiresAt; sync immediately
      // so the countdown starts from a known-good server reference.
      sync(created.serverNow);
      // Fetch full order so the payment screen has items + expiry etc.
      const view = await api.getOrder(created.orderId);
      setScreen({ kind: 'pay', order: view });
      setLines([]);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'insufficient_stock' && typeof e.details === 'object' && e.details) {
          const d = e.details as { productId?: string; available?: number };
          const p = d.productId ? byId.get(d.productId) : undefined;
          setError(
            `${p?.name ?? 'Item'} — only ${d.available ?? 0} left. Please adjust your cart.`,
          );
          await refreshProducts();
        } else {
          setError(e.message.replaceAll('_', ' '));
        }
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">
          Snack Counter <span className="text-snack-muted">·</span>{' '}
          <span className="text-snack-accent">pick, pay, collect</span>
        </h1>
        <span className="text-sm text-snack-muted">{products.length} products</span>
      </header>

      {screen.kind === 'shop' && (
        <div className="grid gap-4 md:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            <ProductShelf
              products={products}
              selectedIds={selectedIds}
              onSelect={toggleProduct}
            />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((p) => {
                const selected = selectedIds.has(p.id);
                const soldOut = p.availableUnits === 0;
                return (
                  <li
                    key={p.id}
                    className={`cursor-pointer rounded-lg border p-3 transition ${
                      soldOut
                        ? 'border-snack-edge opacity-40'
                        : selected
                          ? 'border-snack-accent bg-snack-accent/10'
                          : 'border-snack-edge hover:border-snack-accent/60'
                    }`}
                    onClick={() => !soldOut && toggleProduct(p.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.name}</span>
                      <span className="font-mono text-sm text-snack-muted">
                        {formatPaise(p.pricePaise)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-snack-muted">
                      {soldOut ? 'Sold out' : `${p.availableUnits} available`}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <CartPanel
            products={products}
            lines={lines}
            onChangeQty={setQty}
            onPlaceOrder={placeOrder}
            submitting={busy}
            error={error}
          />
        </div>
      )}

      {screen.kind === 'pay' && (
        <PaymentScreen
          initial={screen.order}
          onDone={(final) => {
            void refreshProducts();
            setScreen({ kind: 'done', order: final });
          }}
        />
      )}

      {screen.kind === 'done' && (
        <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-xl border border-snack-edge bg-snack-panel p-6">
          <h2 className="text-xl font-semibold">
            {screen.order.status === 'picked_up'
              ? 'Order collected'
              : screen.order.status === 'paid'
                ? 'Ready for pickup'
                : screen.order.status === 'expired'
                  ? 'Hold expired'
                  : 'Needs review'}
          </h2>
          <p className="text-sm text-snack-muted">
            Order <span className="font-mono">{screen.order.orderId}</span>
          </p>
          <ul className="space-y-1 text-sm">
            {screen.order.items.map((it) => (
              <li key={it.productId} className="flex justify-between">
                <span>
                  {it.name} × {it.quantity}
                </span>
                <span className="font-mono">{formatPaise(it.unitPricePaise * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-snack-edge pt-3">
            <span>Total</span>
            <span className="font-mono">{formatPaise(screen.order.totalPaise)}</span>
          </div>
          <button
            className="rounded-md bg-snack-accent px-4 py-2 font-semibold text-black"
            onClick={() => {
              setError(null);
              setScreen({ kind: 'shop' });
            }}
          >
            Start a new order
          </button>
        </div>
      )}
    </div>
  );
}