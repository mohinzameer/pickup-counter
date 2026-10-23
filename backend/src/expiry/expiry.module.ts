import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { ExpiryService } from './expiry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [ExpiryService],
})
export class ExpiryModule {}