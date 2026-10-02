import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  SecurityModule,
} from '../security/security.module.js';

import {
  FairPlayAdminController,
  FairPlayController,
} from './fair-play.controller.js';

import {
  FairPlayService,
} from './fair-play.service.js';

@Module({
  imports: [
    AuthModule,
    SecurityModule,
  ],

  controllers: [
    FairPlayController,
    FairPlayAdminController,
  ],

  providers: [
    FairPlayService,
  ],

  exports: [
    FairPlayService,
  ],
})
export class FairPlayModule {}
