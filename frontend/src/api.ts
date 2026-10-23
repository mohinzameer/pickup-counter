// NOTE: endpoint paths are assumptions. Adjust them to match your NestJS controllers.

const BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type OrderStatus = 'pending' | 'paid' | 'picked_up' | 'expired' | 'needs_review';

export type Product = {
  id: string;
  name: string;
  pricePaise: number;
  availableUnits: number;
  stockUnits?: number;
  [key: string]: unknown; // tolerate extra fields your shelf/cart components use
};

export type OrderItemView = {
  productId: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
};

export type OrderView = {
  orderId: string;
  status: OrderStatus;
  totalPaise: number;
  expiresAt: string;
  serverNow: string;
  expiresInSeconds: number;
  paidAt?: string | null;
  pickupClaimedAt?: string | null;
  items: OrderItemView[];
};

export type CreatedOrder = {
  orderId: string;
  totalPaise: number;
  status: 'pending';
  expiresAt: string;
  expiresInSeconds: number;
  serverNow: string;
};

export type OrderLine = { productId: string; quantity: number };

/** Thrown for any non-2xx response or { status: false } envelope. */
export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details: unknown;

  constructor(code: string, httpStatus: number, details?: unknown) {
    super(code); // message is the machine code, e.g. "insufficient_stock"
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

type AnyJson = Record<string, unknown> | undefined;

function isEnvelope(j: AnyJson): j is { status: boolean; message?: string; data?: unknown } {
  return !!j && typeof j.status === 'boolean' && 'data' in j;
}

async function unwrap<T>(res: Response): Promise<T> {
  let json: AnyJson;
  try {
    json = (await res.json()) as AnyJson;
  } catch {
    /* non-JSON body */
  }

  const failed = !res.ok || (isEnvelope(json) && json.status === false);
  if (failed) {
    // Supports both shapes:
    //   Nest raw:  { error: 'insufficient_stock', productId, available, ... }
    //   Envelope:  { status:false, message:'...', data:{ ... } }
    const code =
      (typeof json?.error === 'string' && json.error) ||
      (typeof json?.message === 'string' && json.message) ||
      `request_failed_${res.status}`;
    const details = isEnvelope(json) && json.data !== undefined ? json.data : json;
    throw new ApiError(code, res.status, details);
  }

  // Success: unwrap the envelope if present, otherwise return the raw body.
  return (isEnvelope(json) ? json.data : json) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  return unwrap<T>(res);
}

export const api = {
  listProducts: () => request<Product[]>('/products'),

  getOrder: (orderId: string) =>
    request<OrderView>(`/orders/${encodeURIComponent(orderId)}`),

  createOrder: (lines: OrderLine[]) =>
    request<CreatedOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({ items: lines }),
    }),

  claimPickup: (orderId: string) =>
    request<{ orderId: string; status: 'picked_up' }>(
      `/orders/${encodeURIComponent(orderId)}/pickup-claim`,
      { method: 'POST' },
    ),
};

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}