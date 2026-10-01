import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  AwardsController,
} from './awards.controller.js';

import {
  AwardsService,
} from './awards.service.js';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [
    AwardsController,
  ],
  providers: [
    AwardsService,
  ],
  exports: [
    AwardsService,
  ],
})
export class AwardsModule {}
