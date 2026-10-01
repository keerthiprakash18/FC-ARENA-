import { LeaguesModule } from '../leagues/leagues.module.js';
import { PlayerDashboardService } from './player-dashboard.service.js';

import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  PlayerCareerController,
} from './player-career.controller.js';

import {
  PlayerCareerService,
} from './player-career.service.js';

import {
  PlayerProfileImageService,
} from './player-profile-image.service.js';

@Module({
  imports: [
    AuthModule,
    LeaguesModule,
  ],

  controllers: [
    PlayerCareerController,
  ],

  providers: [
    PlayerCareerService,
    PlayerDashboardService,
    PlayerProfileImageService,
  ],

  exports: [
    PlayerCareerService,
  ],
})
export class PlayerCareerModule {}