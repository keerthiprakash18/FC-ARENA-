import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  DiscoverController,
} from './discover.controller.js';

import {
  DiscoverService,
} from './discover.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    DiscoverController,
  ],

  providers: [
    DiscoverService,
  ],

  exports: [
    DiscoverService,
  ],
})
export class DiscoverModule {}
