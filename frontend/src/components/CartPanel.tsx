import { formatPaise, type Product } from '../api';

export interface CartLine {
  productId: string;
  quantity: number;
}

type Props = {
  products: Product[];
  lines: CartLine[];
  onChangeQty: (productId: string, qty: number) => void;
  onPlaceOrder: () => void;
  submitting: boolean;
  error: string | null;
};

export function CartPanel({
  products,
  lines,
  onChangeQty,
  onPlaceOrder,
  submitting,
  error,
}: Props) {
  const byId = new Map(products.map((p) => [p.id, p]));

  const total = lines.reduce((sum, l) => {
    const p = byId.get(l.productId);
    return sum + (p ? p.pricePaise * l.quantity : 0);
  }, 0);

  const empty = lines.length === 0;

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-snack-edge bg-snack-panel p-4">
      <h2 className="text-lg font-semibold">Your cart</h2>

      {empty && <p className="text-snack-muted">Pick a snack from the shelf.</p>}

      {!empty && (
        <ul className="flex-1 space-y-2 overflow-auto">
          {lines.map((l) => {
            const p = byId.get(l.productId);
            if (!p) return null;
            const max = Math.min(p.availableUnits, 99);
            return (
              <li
                key={l.productId}
                className="flex items-center justify-between gap-3 rounded-md border border-snack-edge px-3 py-2"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-snack-muted">
                    {formatPaise(p.pricePaise)} × {l.quantity} = {formatPaise(p.pricePaise * l.quantity)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="h-7 w-7 rounded-md border border-snack-edge text-sm hover:bg-snack-edge"
                    onClick={() => onChangeQty(l.productId, Math.max(0, l.quantity - 1))}
                    aria-label="decrease"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                  <button
                    className="h-7 w-7 rounded-md border border-snack-edge text-sm hover:bg-snack-edge disabled:opacity-40"
                    onClick={() => onChangeQty(l.productId, Math.min(max, l.quantity + 1))}
                    disabled={l.quantity >= max}
                    aria-label="increase"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-snack-edge pt-3">
        <span className="text-snack-muted">Total</span>
        <span className="font-mono text-lg">{formatPaise(total)}</span>
      </div>

      {error && <p className="rounded-md bg-snack-bad/10 px-3 py-2 text-sm text-snack-bad">{error}</p>}

      <button
        className="rounded-md bg-snack-accent px-4 py-2 font-semibold text-black disabled:opacity-40"
        disabled={empty || submitting}
        onClick={onPlaceOrder}
      >
        {submitting ? 'Placing order…' : 'Place order'}
      </button>
    </div>
  );
}