import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiEnvelope<T> {
  status: true;
  message: string;
  data: T;
}

/**
 * Wraps every successful controller return value in the standard envelope:
 *   { status: true, message: 'ok', data: <value> }
 *
 * Controllers stay clean — they return the domain object and this
 * interceptor adds the transport concerns. HTTP status codes are left
 * untouched (201 for POST, 200 for GET, etc.) so proxies and clients
 * still see the truth.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((data) => ({
        status: true as const,
        message: 'ok',
        data,
      })),
    );
  }
}