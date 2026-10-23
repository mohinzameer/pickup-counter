import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product, WebhookEvent])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}