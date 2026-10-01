import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  BallonController,
} from './ballon.controller.js';

import {
  BallonService,
} from './ballon.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    BallonController,
  ],

  providers: [
    BallonService,
  ],

  exports: [
    BallonService,
  ],
})
export class BallonModule {}
