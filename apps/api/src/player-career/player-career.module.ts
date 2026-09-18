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

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    PlayerCareerController,
  ],

  providers: [
    PlayerCareerService,
  ],

  exports: [
    PlayerCareerService,
  ],
})
export class PlayerCareerModule {}