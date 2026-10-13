import {
  Module,
} from '@nestjs/common';
import {
  APP_INTERCEPTOR,
} from '@nestjs/core';

import {
  RequestTelemetryInterceptor,
} from './request-telemetry.interceptor.js';
import {
  TelemetryController,
} from './telemetry.controller.js';
import {
  TelemetryService,
} from './telemetry.service.js';

@Module({
  controllers: [
    TelemetryController,
  ],
  providers: [
    TelemetryService,
    {
      provide:
        APP_INTERCEPTOR,
      useClass:
        RequestTelemetryInterceptor,
    },
  ],
  exports: [
    TelemetryService,
  ],
})
export class TelemetryModule {}
