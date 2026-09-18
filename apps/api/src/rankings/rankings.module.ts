import {
  Module,
} from '@nestjs/common';
import {
  AuthModule,
} from '../auth/auth.module.js';
import {
  RankingsController,
} from './rankings.controller.js';
import {
  RankingsService,
} from './rankings.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    RankingsController,
  ],

  providers: [
    RankingsService,
  ],

  exports: [
    RankingsService,
  ],
})
export class RankingsModule {}