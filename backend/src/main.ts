import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { ConfigService } from '@nestjs/config';
import { corsPolicy } from './environment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // 启用 CORS
  const config = app.get(ConfigService);
  app.enableCors(
    corsPolicy({
      APP_URL: config.get('APP_URL'),
      CORS_ALLOWED_ORIGINS: config.get('CORS_ALLOWED_ORIGINS'),
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );

  const port = config.get<number>('PORT', 3000);

  await app.listen(port);
}
bootstrap();
