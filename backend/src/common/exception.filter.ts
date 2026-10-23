import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      const response = exception.getResponse();

      // The services throw things like:
      //   new ConflictException({ error: 'insufficient_stock', available: 2 })
      // We map: message <- error field (or the whole string), data <- rest.
      let message = 'error';
      let data: unknown = null;

      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object') {
        const r = response as Record<string, unknown>;
        if (typeof r.error === 'string') message = r.error;
        // Put the whole payload (minus `error`) into data so clients still
        // get structured details like `available`, `productId`, etc.
        const { error: _err, message: _msg, statusCode: _sc, ...rest } = r;
        data = Object.keys(rest).length > 0 ? rest : null;
      }

      res.status(httpStatus).json({
        status: false,
        message,
        data,
      });
      return;
    }

    // Unknown — never leak the exception message or stack to the client.
    this.logger.error(
      {
        path: req.url,
        method: req.method,
        err: exception instanceof Error ? exception.message : exception,
      },
      'Unhandled exception',
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: 'internal_error',
      data: null,
    });
  }
}