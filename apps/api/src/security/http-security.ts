import { BadRequestException, ForbiddenException, ValidationPipe, type INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';

// Shared by production bootstrap and database-backed HTTP tests, so tests
// exercise the same validation, cookie parser, CORS and response headers.
export function configureHttpSecurity(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  const production = process.env.NODE_ENV === 'production';
  if (production) {
    const hops = Number(process.env.TRUST_PROXY_HOPS ?? '1');
    express.set('trust proxy', Number.isInteger(hops) && hops >= 0 ? hops : 1);
  }
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (production) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  const allowed = new Set([
    ...(production ? [] : ['http://localhost:3000']),
    'https://fcarena.in', 'https://www.fcarena.in',
    ...(process.env.WEB_ORIGIN ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ]);
  app.enableCors({
    credentials: true,
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || allowed.has(origin)) return callback(null, true);
      callback(new ForbiddenException({ success: false, data: null, error: {
        code: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not allowed.',
      } }), false);
    },
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    exceptionFactory: (errors) => new BadRequestException({
      success: false, data: null, error: {
        code: 'VALIDATION_ERROR', message: 'The submitted data is invalid.',
        details: errors.flatMap((error) => Object.values(error.constraints ?? {})),
      },
    }),
  }));
}
