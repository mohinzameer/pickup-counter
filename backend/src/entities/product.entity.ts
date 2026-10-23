import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  // Money as whole paise, stored as bigint to avoid overflow.
  // TypeORM returns bigint columns as string; cast at the service boundary.
  @Column({ type: 'bigint', name: 'price_paise' })
  price_paise: string;

  // Total physical units owned. Only pickup-claim decrements this.
  @Column({ type: 'int', name: 'stock_units' })
  stock_units: number;
}