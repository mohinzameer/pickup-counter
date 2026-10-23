import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { OrderItem } from '../entities/order-item.entity';

export interface ProductView {
  id: string;
  name: string;
  pricePaise: number;
  availableUnits: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(OrderItem) private readonly items: Repository<OrderItem>,
  ) {}

  /**
   * availableUnits = stock_units - (sum of quantities in live pending orders).
   *
   * Uses QueryBuilder (still ORM, fully parameterised) because the
   * aggregation has no Repository-only equivalent. Kept in one round trip
   * so a reading can never straddle a state flip.
   */
  async list(): Promise<ProductView[]> {
    const rows = await this.products
      .createQueryBuilder('p')
      .leftJoin(
        (qb) =>
          qb
            .select('oi.product_id', 'product_id')
            .addSelect('SUM(oi.quantity)::int', 'held')
            .from(OrderItem, 'oi')
            .innerJoin('orders', 'o', 'o.id = oi.order_id')
            .where(`o.status = 'pending'`)
            .andWhere('o.expires_at > now()')
            .groupBy('oi.product_id'),
        'h',
        'h.product_id = p.id',
      )
      .select('p.id', 'id')
      .addSelect('p.name', 'name')
      .addSelect('p.price_paise', 'price_paise')
      .addSelect('p.stock_units - COALESCE(h.held, 0)', 'available_units')
      .orderBy('p.name', 'ASC')
      .getRawMany<{
        id: string;
        name: string;
        price_paise: string;
        available_units: number;
      }>();

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      pricePaise: Number(r.price_paise),
      availableUnits: Number(r.available_units),
    }));
  }
}