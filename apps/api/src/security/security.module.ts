import {
  Global,
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  AuditService,
} from './audit.service.js';

import {
  AuthorizationService,
} from './authorization.service.js';

import {
  RoleManagementService,
} from './role-management.service.js';

import {
  SecurityController,
} from './security.controller.js';

@Global()
@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    SecurityController,
  ],

  providers: [
    AuthorizationService,
    AuditService,
    RoleManagementService,
  ],

  exports: [
    AuthorizationService,
    AuditService,
    RoleManagementService,
  ],
})
export class SecurityModule {}