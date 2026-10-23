import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Post('webhook')
  webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const raw = req.rawBody ?? Buffer.alloc(0);
    return this.svc.handle(raw, signature, body as any);
  }
}