import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type {
  Request,
} from 'express';

import type {
  AccessTokenPayload,
} from '../auth/auth.types.js';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
  NotificationsService,
} from './notifications.service.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  @Get()
  getNotifications(
    @Req()
    request:
      AuthenticatedRequest,
  ): Promise<unknown> {
    return this.notificationsService.getNotifications(
      request.user.sub,
    );
  }

  @Post('read-all')
  markAllAsRead(
    @Req()
    request:
      AuthenticatedRequest,
  ): Promise<unknown> {
    return this.notificationsService.markAllAsRead(
      request.user.sub,
    );
  }

  @Post(':notificationId/read')
  markAsRead(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('notificationId')
    notificationId: string,
  ): Promise<unknown> {
    return this.notificationsService.markAsRead(
      request.user.sub,
      notificationId,
    );
  }
}