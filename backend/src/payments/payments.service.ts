import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { env } from '../config/env';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { verifySignature } from './signature';

interface WebhookPayload {
  eventId: string;
  orderId: string;
  amountPaise: number;
  status: 'captured' | 'failed' | string;
}

@Injectable()
export class PaymentsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Late-payment policy (also in README):
   *
   * If `status=captured` arrives after the hold expired:
   *  - If stock is still available, we extend the hold and mark paid — the
   *    customer's money is real, and we can still fulfil.
   *  - If stock is gone, we mark needs_review. We do NOT reject the payment;
   *    dropping a captured UPI silently is worse than surfacing it to a
   *    human operator who can refund.
   *
   * Idempotency: insertion into webhook_events is the gate. A duplicate
   * eventId returns 200 with no side effects.
   */
  async handle(rawBody: Buffer, signatureHeader: string | undefined, body: WebhookPayload) {
    if (!verifySignature(rawBody, signatureHeader, env.WEBHOOK_SECRET)) {
      throw new BadRequestException({ error: 'invalid_signature' });
    }
    if (
      !body ||
      typeof body.eventId !== 'string' ||
      typeof body.orderId !== 'string' ||
      !Number.isInteger(body.amountPaise) ||
      body.amountPaise < 0 ||
      typeof body.status !== 'string'
    ) {
      throw new BadRequestException({ error: 'malformed_payload' });
    }

    return this.ds.transaction('READ COMMITTED', async (m) => {
      // 1. Idempotency gate.
      const inserted = await m
        .createQueryBuilder()
        .insert()
        .into(WebhookEvent)
        .values({
          event_id: body.eventId,
          order_id: body.orderId,
          status: body.status,
          amount_paise: String(body.amountPaise),
        })
        .orIgnore()
        .returning(['event_id'])
        .execute();
      if (inserted.raw.length === 0) {
        return { ok: true, idempotent: true };
      }

      // 2. Lock the order row.
      const order = await m.getRepository(Order).findOne({
        where: { id: body.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException({ error: 'order_not_found' });

      if (order.status === 'paid' || order.status === 'picked_up') {
        return { ok: true, idempotent: true, status: order.status };
      }

      // 3. Amount mismatch -> needs_review. Never mark paid.
      if (Number(order.total_paise) !== body.amountPaise) {
        await m
          .getRepository(Order)
          .update({ id: order.id }, { status: 'needs_review' as OrderStatus });
        return { ok: true, status: 'needs_review', reason: 'amount_mismatch' };
      }

      if (body.status !== 'captured') {
        return { ok: true, status: order.status };
      }

      // 4. Late? Try to re-reserve; on success extend and mark paid.
      const expired = order.expires_at.getTime() <= Date.now();
      if (expired) {
        const canFulfil = await this.tryReserve(m, order);
        if (!canFulfil) {
          await m
            .getRepository(Order)
            .update(
              { id: order.id },
              { status: 'needs_review' as OrderStatus, paid_at: new Date() },
            );
          return { ok: true, status: 'needs_review', reason: 'late_and_sold_out' };
        }
        // Fall through: mark paid below with extended expiry.
      }

      const newExpires = expired
        ? new Date(Date.now() + env.HOLD_SECONDS * 1000)
        : order.expires_at;

      await m
        .getRepository(Order)
        .update(
          { id: order.id },
          {
            status: 'paid' as OrderStatus,
            paid_at: new Date(),
            expires_at: newExpires,
          },
        );
      return { ok: true, status: 'paid' };
    });
  }

  /**
   * For a late payment, recompute availability and (if sufficient) push
   * expires_at into the future so the availability view counts this order
   * as held again until pickup. Lock products in sorted order to match
   * the order-create locking discipline.
   */
  private async tryReserve(m: EntityManager, order: Order): Promise<boolean> {
    const items = await m.getRepository(OrderItem).find({
      where: { order_id: order.id },
      order: { product_id: 'ASC' },
    });
    const ids = items.map((i) => i.product_id);

    const products = await m.getRepository(Product).find({
      where: { id: In(ids) },
      lock: { mode: 'pessimistic_write' },
      order: { id: 'ASC' },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Held by *other* live pending orders.
    const otherHeld = await m
      .createQueryBuilder(OrderItem, 'oi')
      .innerJoin(Order, 'o', 'o.id = oi.order_id')
      .select('oi.product_id', 'product_id')
      .addSelect('SUM(oi.quantity)::int', 'held')
      .where('oi.product_id IN (:...ids)', { ids })
      .andWhere(`o.status = 'pending'`)
      .andWhere('o.expires_at > now()')
      .andWhere('o.id <> :orderId', { orderId: order.id })
      .groupBy('oi.product_id')
      .getRawMany<{ product_id: string; held: number }>();
    const heldMap = new Map(otherHeld.map((r) => [r.product_id, Number(r.held)]));

    return items.every((it) => {
      const p = byId.get(it.product_id);
      if (!p) return false;
      const free = p.stock_units - (heldMap.get(p.id) ?? 0);
      return it.quantity <= free;
    });
  }
}