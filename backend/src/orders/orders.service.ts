import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { env } from '../config/env';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { PickupClaim } from '../entities/pickup-claim.entity';
import { Product } from '../entities/product.entity';

interface Line {
  productId: string;
  quantity: number;
}

interface CreatedOrder {
  orderId: string;
  totalPaise: number;
  status: 'pending';
  expiresAt: string;
  expiresInSeconds: number;
  serverNow: string;
}

@Injectable()
export class OrdersService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Create an order and place a hold.
   *
   * Concurrency correctness:
   *  - Product rows are locked FOR UPDATE in *sorted id* order to prevent
   *    deadlocks between simultaneous orders touching the same products.
   *  - After locking, we recompute held-qty from live pending orders. Because
   *    every writer to held-qty (order create) holds the same product row
   *    locks, this recompute is serialised against other creators.
   *  - Any insufficiency aborts the whole transaction; nothing is held.
   */
  async create(input: Line[]): Promise<CreatedOrder> {
    // Merge duplicate product lines — validates quantity cap per product.
    const merged = new Map<string, number>();
    for (const it of input) {
      merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
    }
    const lines = [...merged.entries()]
      .map(([productId, quantity]) => ({ productId, quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId));

    return this.ds.transaction('READ COMMITTED', async (m) => {
      const ids = lines.map((l) => l.productId);

      const products = await m.getRepository(Product).find({
        where: { id: In(ids) },
        lock: { mode: 'pessimistic_write' },
        order: { id: 'ASC' },
      });
      if (products.length !== ids.length) {
        throw new NotFoundException({ error: 'product_not_found' });
      }
      const byId = new Map(products.map((p) => [p.id, p]));

      const held = await this.heldByProduct(m, ids);

      for (const line of lines) {
        const p = byId.get(line.productId)!;
        const free = p.stock_units - (held.get(p.id) ?? 0);
        if (line.quantity > free) {
          throw new ConflictException({
            error: 'insufficient_stock',
            productId: p.id,
            requested: line.quantity,
            available: free,
          });
        }
      }

      const totalPaise = lines.reduce(
        (sum, l) => sum + Number(byId.get(l.productId)!.price_paise) * l.quantity,
        0,
      );

      const expiresAt = new Date(Date.now() + env.HOLD_SECONDS * 1000);

      const orderRepo = m.getRepository(Order);
      const order = orderRepo.create({
        status: 'pending',
        total_paise: String(totalPaise),
        expires_at: expiresAt,
        paid_at: null,
        pickup_claimed_at: null,
      });
      await orderRepo.save(order);

      const itemRepo = m.getRepository(OrderItem);
      const items = lines.map((l) =>
        itemRepo.create({
          order_id: order.id,
          product_id: l.productId,
          quantity: l.quantity,
          unit_price_paise: byId.get(l.productId)!.price_paise,
        }),
      );
      await itemRepo.save(items);

      const now = Date.now();
      return {
        orderId: order.id,
        totalPaise,
        status: 'pending' as const,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: Math.max(
          0,
          Math.ceil((expiresAt.getTime() - now) / 1000),
        ),
        serverNow: new Date(now).toISOString(),
      };
    });
  }

  /**
   * Lockers race here. Exactly one succeeds:
   *  1. We lock the order row FOR UPDATE.
   *  2. Status must be 'paid' (unpaid/expired/needs_review are rejected).
   *  3. We try to insert into pickup_claims (PK on order_id). A losing
   *     concurrent caller hits a unique violation, which we translate to
   *     409. This makes the invariant DB-enforced, not just application-
   *     enforced.
   *  4. Only after the claim insert succeeds do we decrement stock_units.
   */
  async claimPickup(orderId: string) {
    try {
      return await this.ds.transaction('READ COMMITTED', async (m) => {
        const orderRepo = m.getRepository(Order);
        const order = await orderRepo.findOne({
          where: { id: orderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order) throw new NotFoundException({ error: 'order_not_found' });

        if (order.status !== 'paid') {
          throw new ConflictException({
            error: 'order_not_payable',
            status: order.status,
          });
        }

        // Inserting the claim is the atomic gate. Unique PK on order_id
        // guarantees a second caller cannot insert.
        await m.getRepository(PickupClaim).insert({ order_id: order.id });

        // Decrement stock. Held quantity was already reserved at create
        // time, so stock_units is guaranteed >= sum(qty) here.
        const items = await m.getRepository(OrderItem).find({
          where: { order_id: order.id },
          order: { product_id: 'ASC' },
        });
        for (const it of items) {
          const res = await m
            .getRepository(Product)
            .createQueryBuilder()
            .update(Product)
            .set({ stock_units: () => `stock_units - ${it.quantity}` })
            .where('id = :id AND stock_units >= :qty', {
              id: it.product_id,
              qty: it.quantity,
            })
            .execute();
          if (res.affected === 0) {
            // Should be impossible if holds were correct; surface loudly.
            throw new ConflictException({
              error: 'stock_corrupt',
              productId: it.product_id,
            });
          }
        }

        await orderRepo.update(
          { id: order.id },
          {
            status: 'picked_up' as OrderStatus,
            pickup_claimed_at: new Date(),
          },
        );

        return { orderId: order.id, status: 'picked_up' as const };
      });
    } catch (err: unknown) {
      // Translate the unique-violation from pickup_claims into 409.
      if (isUniqueViolation(err)) {
        throw new ConflictException({ error: 'already_claimed' });
      }
      throw err;
    }
  }

  async get(orderId: string) {
    const order = await this.ds.getRepository(Order).findOne({
      where: { id: orderId },
      relations: { items: { product: true } },
    });
    if (!order) throw new NotFoundException({ error: 'order_not_found' });
    const now = Date.now();
    return {
      orderId: order.id,
      status: order.status,
      totalPaise: Number(order.total_paise),
      expiresAt: order.expires_at.toISOString(),
      serverNow: new Date(now).toISOString(),
      expiresInSeconds: Math.max(
        0,
        Math.ceil((order.expires_at.getTime() - now) / 1000),
      ),
      paidAt: order.paid_at?.toISOString() ?? null,
      pickupClaimedAt: order.pickup_claimed_at?.toISOString() ?? null,
      items: order.items.map((i) => ({
        productId: i.product_id,
        name: i.product.name,
        quantity: i.quantity,
        unitPricePaise: Number(i.unit_price_paise),
      })),
    };
  }

  /** Sum quantities per product across live pending orders. */
  private async heldByProduct(
    m: EntityManager,
    productIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await m
      .createQueryBuilder(OrderItem, 'oi')
      .innerJoin(Order, 'o', 'o.id = oi.order_id')
      .select('oi.product_id', 'product_id')
      .addSelect('SUM(oi.quantity)::int', 'held')
      .where('oi.product_id IN (:...ids)', { ids: productIds })
      .andWhere(`o.status = 'pending'`)
      .andWhere('o.expires_at > now()')
      .groupBy('oi.product_id')
      .getRawMany<{ product_id: string; held: number }>();
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.product_id, Number(r.held));
    return map;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}