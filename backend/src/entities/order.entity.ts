import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'expired'
  | 'needs_review'
  | 'picked_up';

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', default: 'pending' })
  status: OrderStatus;

  @Column({ type: 'bigint', name: 'total_paise' })
  total_paise: string;

  @Index()
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expires_at: Date;

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'timestamptz', name: 'pickup_claimed_at', nullable: true })
  pickup_claimed_at: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  created_at: Date;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: ['insert'] })
  items: OrderItem[];
}