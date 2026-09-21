import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  DisputesController,
} from './disputes.controller.js';

import {
  DisputesService,
} from './disputes.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    DisputesController,
  ],

  providers: [
    DisputesService,
  ],
})
export class DisputesModule {}
