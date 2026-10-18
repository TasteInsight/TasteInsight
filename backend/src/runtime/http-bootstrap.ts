import { Type, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as bodyParser from 'body-parser';
import { corsPolicy } from '../environment';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createMetrics } from './metrics';

export async function bootstrapHttp(
  module: Type<unknown>,
  queueNames: string[] = [],
) {
  const app = await NestFactory.create(module);
  app.enableShutdownHooks();
  const metrics = createMetrics(
    queueNames.map((name) => app.get<Queue>(getQueueToken(name))),
  );
  app.use(metrics.middleware);
  app.getHttpAdapter().get('/metrics', metrics.handle);
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  const config = app.get(ConfigService);
  const trustedProxies = config
    .get<string>('TRUSTED_PROXY_CIDRS', '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (trustedProxies.length) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustedProxies);
  }
  app.enableCors(
    corsPolicy({
      APP_URL: config.get('APP_URL'),
      ADMIN_APP_URL: config.get('ADMIN_APP_URL'),
      CORS_ALLOWED_ORIGINS: config.get('CORS_ALLOWED_ORIGINS'),
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );
  await app.listen(config.get<number>('PORT', 3000));
  return app;
}
