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
  CommercialAdminController,
  CommercialController,
} from './commercial.controller.js';

import {
  CommercialService,
} from './commercial.service.js';

@Module({
  imports: [
    AuthModule,
    SecurityModule,
  ],

  controllers: [
    CommercialController,
    CommercialAdminController,
  ],

  providers: [
    CommercialService,
  ],

  exports: [
    CommercialService,
  ],
})
export class CommercialModule {}
