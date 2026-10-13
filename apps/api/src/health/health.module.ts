import { Module } from '@nestjs/common';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [TelemetryModule],
  controllers: [HealthController],
})
export class HealthModule {}