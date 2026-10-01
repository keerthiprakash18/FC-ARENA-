import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  AdminOpsController,
  BackupReportController,
  MobileVersionController,
} from './admin-ops.controller.js';

import {
  AdminOpsService,
} from './admin-ops.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    AdminOpsController,
    MobileVersionController,
    BackupReportController,
  ],

  providers: [
    AdminOpsService,
  ],

  exports: [
    AdminOpsService,
  ],
})
export class AdminOpsModule {}
