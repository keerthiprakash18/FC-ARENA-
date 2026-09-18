import {
  Controller,
  Get,
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
  PlayerCareerService,
} from './player-career.service.js';

type AuthenticatedRequest =
  Request & {
    user: AccessTokenPayload;
  };

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayerCareerController {
  constructor(
    private readonly playerCareerService:
      PlayerCareerService,
  ) {}

  @Get('me/career')
  myCareer(
    @Req()
    request:
      AuthenticatedRequest,
  ): Promise<unknown> {
    return this.playerCareerService.getMyCareer(
      request.user.sub,
    );
  }
}