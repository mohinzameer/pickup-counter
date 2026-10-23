import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './data-source';
import { AllExceptionsFilter } from './common/exception.filter';
import { ResponseInterceptor } from './common/response.interceptor';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ExpiryModule } from './expiry/expiry.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ...AppDataSource.options }),
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    ExpiryModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}