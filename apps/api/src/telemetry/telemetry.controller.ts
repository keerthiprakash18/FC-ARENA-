import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import {
  WebVitalDto,
} from './dto/web-vital.dto.js';
import {
  TelemetryService,
} from './telemetry.service.js';

@Controller('telemetry')
export class TelemetryController {
  constructor(
    private readonly telemetry:
      TelemetryService,
  ) {}

  @Post('web-vitals')
  @HttpCode(
    HttpStatus.ACCEPTED,
  )
  recordWebVital(
    @Body()
    dto: WebVitalDto,
  ) {
    this.telemetry.recordWebVital(
      dto.name,
      dto.value,
    );

    return {
      success: true,
      data: {
        accepted: true,
      },
      error: null,
    };
  }
}
