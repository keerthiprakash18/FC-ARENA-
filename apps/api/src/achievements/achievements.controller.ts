import {
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { LiveAwardRacesDto } from './dto/live-award-races.dto.js';

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

  @Get('awards/live-races')
  liveRaces(@Req() request: AuthenticatedRequest, @Query() query: LiveAwardRacesDto) {
    return this.achievementsService.getLiveAwardRaces(request.user.sub, query.offset, query.limit);
  }

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
    'tournaments/:tournamentId/award-races',
  )
  tournamentAwardRaces(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ): Promise<unknown> {
    return this.achievementsService.getTournamentAwardRaces(
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
    'tournaments/:tournamentId/summary',
  )
  tournamentSummary(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ): Promise<unknown> {
    return this.achievementsService.getTournamentSummary(
      request.user.sub,
      tournamentId,
    );
  }

  @Get(
    'tournament-summaries',
  )
  tournamentSummaryHistory(
    @Req()
    request:
      AuthenticatedRequest,
  ): Promise<unknown> {
    return this.achievementsService.getTournamentSummaryHistory(
      request.user.sub,
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
