import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config/env';
import { rawBodyMiddleware } from './common/raw-body.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // we install our own parser that captures raw bytes
    logger: ['error', 'warn', 'log'],
  });

  // OWASP headers.
  app.use(helmet());

  // CORS: explicitly allow the Vite dev origin; adjust in prod.
  app.enableCors({
    origin: [/^http:\/\/localhost:\d+$/],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Signature'],
    maxAge: 600,
  });

  // Validation: strip unknown props, forbid non-whitelisted ones, coerce types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Must run before Nest routes so req.rawBody is populated for HMAC.
  app.use(rawBodyMiddleware);

  app.enableShutdownHooks();
  await app.listen(env.PORT);
  // eslint-disable-next-line no-console
  console.log(`listening on :${env.PORT}`);
}

bootstrap();