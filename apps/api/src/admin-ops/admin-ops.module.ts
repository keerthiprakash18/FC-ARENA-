import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  PlayerCareerModule,
} from '../player-career/player-career.module.js';

import {
  AdminOpsController,
  BackupReportController,
  MobileVersionController,
} from './admin-ops.controller.js';

import {
  AdminOpsService,
} from './admin-ops.service.js';

import {
  PrivacyOpsService,
} from './privacy-ops.service.js';

@Module({
  imports: [
    AuthModule,
    PlayerCareerModule,
  ],

  controllers: [
    AdminOpsController,
    MobileVersionController,
    BackupReportController,
  ],

  providers: [
    AdminOpsService,
    PrivacyOpsService,
  ],

  exports: [
    AdminOpsService,
  ],
})
export class AdminOpsModule {}
