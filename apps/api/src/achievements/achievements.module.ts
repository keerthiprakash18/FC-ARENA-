import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  AchievementsController,
} from './achievements.controller.js';

import {
  AchievementsService,
} from './achievements.service.js';

@Module({
  imports: [
    AuthModule,
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