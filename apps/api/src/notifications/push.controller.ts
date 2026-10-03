import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsString,
  Length,
  Matches,
} from 'class-validator';
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
  PushService,
} from './push.service.js';

class DeviceTokenDto {
  @IsString()
  @Length(
    20,
    2048,
  )
  @Matches(
    /^[A-Za-z0-9_:-]+$/,
  )
  token!: string;
}

type AuthRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller(
  'notifications/push',
)
@UseGuards(
  JwtAuthGuard,
)
export class PushController {
  constructor(
    private readonly push:
      PushService,
  ) {}

  @Get('status')
  status(
    @Req()
    req:
      AuthRequest,
  ) {
    return this.push.status(
      req.user.sub,
      req.user.sid,
    );
  }

  @Post('register')
  register(
    @Req()
    req:
      AuthRequest,
    @Body()
    dto:
      DeviceTokenDto,
  ) {
    return this.push.register(
      req.user.sub,
      req.user.sid,
      dto.token,
    );
  }

  @Post('disable')
  disable(
    @Req()
    req:
      AuthRequest,
    @Body()
    dto:
      DeviceTokenDto,
  ) {
    return this.push.disable(
      req.user.sub,
      dto.token,
    );
  }

  @Post('disable-session')
  disableSession(
    @Req()
    req:
      AuthRequest,
  ) {
    return this.push.disableSession(
      req.user.sub,
      req.user.sid,
    );
  }
}
