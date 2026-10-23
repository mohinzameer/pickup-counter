import { MigrationInterface, QueryRunner } from 'typeorm';

export class PickupClaims1700000001000 implements MigrationInterface {
  name = 'PickupClaims1700000001000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE pickup_claims (
        order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
        claimed_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS pickup_claims`);
  }
}