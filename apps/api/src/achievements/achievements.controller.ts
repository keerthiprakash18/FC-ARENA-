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
  AchievementsService,
} from './achievements.service.js';

type AuthenticatedRequest =
  Request & {
    user: AccessTokenPayload;
  };

@Controller()
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(
    private readonly achievementsService:
      AchievementsService,
  ) {}

  @Post(
    'tournaments/:tournamentId/complete',
  )
  completeTournament(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ): Promise<unknown> {
    return this.achievementsService.completeTournament(
      request.user.sub,
      tournamentId,
    );
  }

  @Get(
    'tournaments/:tournamentId/achievements',
  )
  tournamentAchievements(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ): Promise<unknown> {
    return this.achievementsService.getTournamentAchievements(
      request.user.sub,
      tournamentId,
    );
  }

  @Get(
    'players/me/achievements',
  )
  myAchievements(
    @Req()
    request:
      AuthenticatedRequest,
  ): Promise<unknown> {
    return this.achievementsService.getMyAchievements(
      request.user.sub,
    );
  }
}