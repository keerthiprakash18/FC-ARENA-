import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type {
  Request,
} from 'express';
import type {
  Observable,
} from 'rxjs';
import {
  finalize,
} from 'rxjs';

import {
  TelemetryService,
} from './telemetry.service.js';

@Injectable()
export class RequestTelemetryInterceptor
  implements NestInterceptor {
  constructor(
    private readonly telemetry:
      TelemetryService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (
      context.getType() !==
      'http'
    ) {
      return next.handle();
    }

    const request =
      context
        .switchToHttp()
        .getRequest<Request>();

    const originalUrl =
      request.originalUrl ??
      request.url ??
      '';

    const excluded =
      originalUrl.startsWith(
        '/api/health',
      ) ||
      originalUrl.startsWith(
        '/api/telemetry',
      );

    if (excluded) {
      return next.handle();
    }

    const started =
      performance.now();

    return next.handle().pipe(
      finalize(
        () => {
          this.telemetry.recordApiLatency(
            performance.now() -
              started,
          );
        },
      ),
    );
  }
}
