import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await q.query(`
      CREATE TABLE products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        price_paise bigint NOT NULL CHECK (price_paise >= 0),
        stock_units int NOT NULL CHECK (stock_units >= 0)
      )
    `);

    await q.query(`
      CREATE TABLE orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','paid','expired','needs_review','picked_up')),
        total_paise bigint NOT NULL CHECK (total_paise >= 0),
        expires_at timestamptz NOT NULL,
        paid_at timestamptz,
        pickup_claimed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX orders_status_expires_idx ON orders(status, expires_at)`);

    await q.query(`
      CREATE TABLE order_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id),
        quantity int NOT NULL CHECK (quantity > 0),
        unit_price_paise bigint NOT NULL CHECK (unit_price_paise >= 0)
      )
    `);
    await q.query(`CREATE INDEX order_items_order_idx ON order_items(order_id)`);
    await q.query(`CREATE INDEX order_items_product_idx ON order_items(product_id)`);

    await q.query(`
      CREATE TABLE webhook_events (
        event_id text PRIMARY KEY,
        order_id uuid NOT NULL,
        status text NOT NULL,
        amount_paise bigint NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS webhook_events`);
    await q.query(`DROP TABLE IF EXISTS order_items`);
    await q.query(`DROP TABLE IF EXISTS orders`);
    await q.query(`DROP TABLE IF EXISTS products`);
  }
}