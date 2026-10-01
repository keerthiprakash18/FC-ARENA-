import {
  Body,
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
  AwardsService,
} from './awards.service.js';

import {
  CreateBallonSeasonDto,
} from './dto/create-ballon-season.dto.js';

type AuthenticatedRequest =
  Request & {
    user: AccessTokenPayload;
  };

@Controller()
@UseGuards(JwtAuthGuard)
export class AwardsController {
  constructor(
    private readonly awardsService:
      AwardsService,
  ) {}

  @Get(
    'tournaments/:tournamentId/award-races',
  )
  tournamentAwardRace(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.awardsService.getTournamentAwardRace(
      request.user.sub,
      tournamentId,
    );
  }

  @Get(
    'ballon/seasons',
  )
  listBallonSeasons(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.awardsService.listBallonSeasons(
      request.user.sub,
    );
  }

  @Get(
    'ballon/seasons/current',
  )
  currentBallonSeason(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.awardsService.getCurrentBallonSeason(
      request.user.sub,
    );
  }

  @Get(
    'ballon/seasons/:seasonId/rankings',
  )
  ballonSeasonRankings(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.awardsService.getBallonSeasonRankings(
      request.user.sub,
      seasonId,
    );
  }

  @Post(
    'ballon/seasons',
  )
  createBallonSeason(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      CreateBallonSeasonDto,
  ) {
    return this.awardsService.createBallonSeason(
      request.user.sub,
      dto,
    );
  }

  @Post(
    'ballon/seasons/:seasonId/start',
  )
  startBallonSeason(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.awardsService.startBallonSeason(
      request.user.sub,
      seasonId,
    );
  }

  @Post(
    'ballon/seasons/:seasonId/finalize',
  )
  finalizeBallonSeason(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.awardsService.finalizeBallonSeason(
      request.user.sub,
      seasonId,
    );
  }

  @Post(
    'ballon/seasons/:seasonId/archive',
  )
  archiveBallonSeason(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.awardsService.archiveBallonSeason(
      request.user.sub,
      seasonId,
    );
  }
}
