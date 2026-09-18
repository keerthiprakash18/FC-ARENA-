import {
  Controller,
  Get,
  Param,
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
  RankingsService,
} from './rankings.service.js';

type AuthenticatedRequest =
  Request & {
    user: AccessTokenPayload;
  };

@Controller()
@UseGuards(JwtAuthGuard)
export class RankingsController {
  constructor(
    private readonly rankingsService:
      RankingsService,
  ) {}

  @Get(
    'tournaments/:tournamentId/rankings',
  )
  tournamentRankings(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ): Promise<unknown> {
    return this.rankingsService.getTournamentRankings(
      request.user.sub,
      tournamentId,
    );
  }

  @Get(
    'leagues/:leagueId/rankings',
  )
  leagueRankings(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('leagueId')
    leagueId: string,

    @Query('mode')
    mode?: string,
  ): Promise<unknown> {
    return this.rankingsService.getLeagueRankings(
      request.user.sub,
      leagueId,
      mode,
    );
  }
}