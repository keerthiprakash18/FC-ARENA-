import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ExperienceController } from './experience.controller.js';
import { ExperienceService } from './experience.service.js';
import { DailyRewardsController } from './daily-rewards.controller.js';
import { DailyRewardsService } from './daily-rewards.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ExperienceController, DailyRewardsController],
  providers: [ExperienceService, DailyRewardsService],
  exports: [ExperienceService],
})
export class ExperienceModule {}
