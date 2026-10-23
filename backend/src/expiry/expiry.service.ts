import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';

/**
 * Every 5 seconds, flip pending orders past expires_at to 'expired'.
 *
 * This is *cosmetic* for availability: the live-pending definition already
 * excludes expired orders (`o.expires_at > now()`). Flipping the status
 * keeps the dashboard and any future reporting honest.
 *
 * The flip is a single UPDATE; no locks needed because we only transition
 * pending -> expired for rows whose expires_at is already in the past and
 * we guard the WHERE on status='pending' so a concurrent payment that just
 * flipped the order to 'paid' is not clobbered.
 */
@Injectable()
export class ExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiryService.name);
  private timer?: NodeJS.Timeout;
  private stopped = false;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick(), 5000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.stopped) return;
    try {
      const res = await this.ds
        .getRepository(Order)
        .createQueryBuilder()
        .update(Order)
        .set({ status: 'expired' as OrderStatus })
        .where(`status = 'pending' AND expires_at <= now()`)
        .execute();
      if (res.affected) {
        this.logger.log(`marked ${res.affected} order(s) expired`);
      }
    } catch (err) {
      this.logger.error({ err }, 'expiry tick failed');
    }
  }
}