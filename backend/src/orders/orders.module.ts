import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { PickupClaim } from '../entities/pickup-claim.entity';
import { Product } from '../entities/product.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, PickupClaim, Product])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}