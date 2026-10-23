import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './config/env';
import { Product } from './entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PickupClaim } from './entities/pickup-claim.entity';
import { Init1700000000000 } from './migrations/1700000000000-Init';
import { PickupClaims1700000001000 } from './migrations/1700000001000-PickupClaims';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [Product, Order, OrderItem, WebhookEvent, PickupClaim],
  migrations: [Init1700000000000, PickupClaims1700000001000],
  // IMPORTANT: never synchronize in prod — schema changes go through migrations.
  synchronize: false,
  logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});