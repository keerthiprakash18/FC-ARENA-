import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  MatchRealtimeService,
} from './match-realtime.service.js';

import {
  MatchesController,
} from './matches.controller.js';

import {
  MatchesService,
} from './matches.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    MatchesController,
  ],

  providers: [
    MatchesService,
    MatchRealtimeService,
  ],

  exports: [
    MatchesService,
    MatchRealtimeService,
  ],
})
export class MatchesModule {}
