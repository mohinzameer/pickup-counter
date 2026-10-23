import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ParseUuidPipe } from '../common/parse-uuid.pipe';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.svc.create(dto.items);
  }

  @Get(':id')
  get(@Param('id', ParseUuidPipe) id: string) {
    return this.svc.get(id);
  }

  @Post(':id/pickup-claim')
  claim(@Param('id', ParseUuidPipe) id: string) {
    return this.svc.claimPickup(id);
  }

  
}