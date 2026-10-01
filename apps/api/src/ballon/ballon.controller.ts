import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  BallonService,
} from './ballon.service.js';
import {
  CreateBallonSeasonDto,
} from './dto/create-ballon-season.dto.js';
import {
  UpdateBallonSeasonDto,
} from './dto/update-ballon-season.dto.js';

type AuthenticatedRequest =
  Request & {
    user: AccessTokenPayload;
  };

@Controller()
@UseGuards(JwtAuthGuard)
export class BallonController {
  constructor(
    private readonly ballonService:
      BallonService,
  ) {}

  @Get('awards/overview')
  overview(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.ballonService.getAwardsOverview(
      request.user.sub,
    );
  }

  @Get('ballon/seasons')
  seasons(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.ballonService.getSeasons(
      request.user.sub,
    );
  }

  @Get('ballon/seasons/current')
  current(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.ballonService.getCurrentSeason(
      request.user.sub,
    );
  }

  @Get('ballon/seasons/:seasonId')
  season(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.ballonService.getSeason(
      request.user.sub,
      seasonId,
    );
  }

  @Get(
    'ballon/seasons/:seasonId/rankings',
  )
  rankings(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,

    @Query('limit')
    limit?: string,
  ) {
    return this.ballonService.getRankings(
      request.user.sub,
      seasonId,
      limit,
    );
  }

  @Get(
    'ballon/seasons/:seasonId/rankings/me',
  )
  myRanking(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.ballonService.getMyRanking(
      request.user.sub,
      seasonId,
    );
  }

  @Get(
    'ballon/seasons/:seasonId/players/:userId',
  )
  player(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,

    @Param('userId')
    userId: string,
  ) {
    return this.ballonService.getPlayerRanking(
      request.user.sub,
      seasonId,
      userId,
    );
  }

  @Post('admin/ballon/seasons')
  create(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      CreateBallonSeasonDto,
  ) {
    return this.ballonService.createSeason(
      request.user.sub,
      dto,
    );
  }

  @Patch(
    'admin/ballon/seasons/:seasonId',
  )
  update(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,

    @Body()
    dto:
      UpdateBallonSeasonDto,
  ) {
    return this.ballonService.updateSeason(
      request.user.sub,
      seasonId,
      dto,
    );
  }

  @Post(
    'admin/ballon/seasons/:seasonId/start',
  )
  start(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.ballonService.startSeason(
      request.user.sub,
      seasonId,
    );
  }

  @Post(
    'admin/ballon/seasons/:seasonId/finalize',
  )
  finalize(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.ballonService.finalizeSeason(
      request.user.sub,
      seasonId,
    );
  }

  @Post(
    'admin/ballon/seasons/:seasonId/lock',
  )
  lock(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.ballonService.lockSeason(
      request.user.sub,
      seasonId,
    );
  }

  @Post(
    'admin/ballon/seasons/:seasonId/archive',
  )
  archive(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('seasonId')
    seasonId: string,
  ) {
    return this.ballonService.archiveSeason(
      request.user.sub,
      seasonId,
    );
  }
}
