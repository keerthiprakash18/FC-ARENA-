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
  SafetyController,
} from './safety.controller.js';

import {
  SafetyService,
} from './safety.service.js';

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
    SafetyController,
  ],

  providers: [
    AuthorizationService,
    AuditService,
    RoleManagementService,
    SafetyService,
  ],

  exports: [
    AuthorizationService,
    AuditService,
    RoleManagementService,
    SafetyService,
  ],
})
export class SecurityModule {}