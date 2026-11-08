import { PushController } from './push.controller.js';
import { PushService } from './push.service.js';
import { FixtureDayRemindersService } from './fixture-day-reminders.service.js';
import { RegistrationNotificationsService } from './registration-notifications.service.js';
import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  NotificationsController,
} from './notifications.controller.js';

import {
  NotificationsService,
} from './notifications.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    NotificationsController,
    PushController,
  ],

  providers: [
    NotificationsService,
    PushService,
    FixtureDayRemindersService,
    RegistrationNotificationsService,
  ],

  exports: [
    NotificationsService,
    RegistrationNotificationsService,
  ],
})
export class NotificationsModule {}
