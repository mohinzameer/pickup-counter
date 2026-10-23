import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * One row per webhook eventId. The PK doubles as our idempotency key:
 * INSERT ... ON CONFLICT DO NOTHING inside the payment transaction.
 */
@Entity({ name: 'webhook_events' })
export class WebhookEvent {
  @PrimaryColumn({ type: 'text', name: 'event_id' })
  event_id: string;

  @Column({ type: 'uuid', name: 'order_id' })
  order_id: string;

  @Column({ type: 'text' })
  status: string;

  @Column({ type: 'bigint', name: 'amount_paise' })
  amount_paise: string;

  @Column({ type: 'timestamptz', name: 'received_at', default: () => 'now()' })
  received_at: Date;
}