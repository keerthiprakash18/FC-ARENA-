import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  AwardsModule,
} from '../awards/awards.module.js';

import {
  AchievementsController,
} from './achievements.controller.js';

import {
  AchievementsService,
} from './achievements.service.js';

@Module({
  imports: [
    AuthModule,
    AwardsModule,
  ],

  controllers: [
    AchievementsController,
  ],

  providers: [
    AchievementsService,
  ],

  exports: [
    AchievementsService,
  ],
})
export class AchievementsModule {}