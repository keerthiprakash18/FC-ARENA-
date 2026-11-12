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
import { DurableTelemetryService } from './durable-telemetry.service.js';

@Module({
  controllers: [
    TelemetryController,
  ],
  providers: [
    TelemetryService,
    DurableTelemetryService,
    {
      provide:
        APP_INTERCEPTOR,
      useClass:
        RequestTelemetryInterceptor,
    },
  ],
  exports: [
    TelemetryService,
    DurableTelemetryService,
  ],
})
export class TelemetryModule {}
