import 'dotenv/config';
import {
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.use(cookieParser());

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The submitted data is invalid.',
            details: errors.flatMap((error) =>
              Object.values(error.constraints ?? {}),
            ),
          },
        }),
    }),
  );

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);

  await app.listen(port);

  console.log('');
  console.log('============================================');
  console.log(' FC ARENA API STARTED');
  console.log(` API:    http://localhost:${port}/api`);
  console.log(` Health: http://localhost:${port}/api/health`);
  console.log('============================================');
  console.log('');
}

void bootstrap();