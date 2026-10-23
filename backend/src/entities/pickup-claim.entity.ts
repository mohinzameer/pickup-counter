import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Belt-and-braces against double pickup. The primary key on order_id means
 * a second INSERT for the same order fails at the storage layer regardless
 * of any application bug in the row-locked path.
 */
@Entity({ name: 'pickup_claims' })
export class PickupClaim {
  @PrimaryColumn({ type: 'uuid', name: 'order_id' })
  order_id: string;

  @Column({ type: 'timestamptz', name: 'claimed_at', default: () => 'now()' })
  claimed_at: Date;
}