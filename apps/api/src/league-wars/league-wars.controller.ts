import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  CreateLeagueWarDto,
  SetLeagueWarRosterDto,
  UpdateLeagueWarResultDto,
} from './dto/league-war.dto.js';
import {
  LeagueWarsService,
} from './league-wars.service.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('league-wars')
@UseGuards(JwtAuthGuard)
export class LeagueWarsController {
  constructor(
    private readonly service:
      LeagueWarsService,
  ) {}

  @Get()
  getWars(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.service.getWars(
      request.user.sub,
    );
  }

  @Post()
  create(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      CreateLeagueWarDto,
  ) {
    return this.service.createWar(
      request.user.sub,
      dto,
    );
  }

  @Get(':warId')
  getWar(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('warId')
    warId: string,
  ) {
    return this.service.getWar(
      request.user.sub,
      warId,
    );
  }

  @Post(':warId/accept')
  accept(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('warId')
    warId: string,
  ) {
    return this.service.acceptWar(
      request.user.sub,
      warId,
    );
  }

  @Post(':warId/roster')
  setRoster(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('warId')
    warId: string,

    @Body()
    dto:
      SetLeagueWarRosterDto,
  ) {
    return this.service.setRoster(
      request.user.sub,
      warId,
      dto,
    );
  }

  @Post(':warId/start')
  start(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('warId')
    warId: string,
  ) {
    return this.service.startWar(
      request.user.sub,
      warId,
    );
  }

  @Patch(
    ':warId/matches/:matchId/result',
  )
  updateResult(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('warId')
    warId: string,

    @Param('matchId')
    matchId: string,

    @Body()
    dto:
      UpdateLeagueWarResultDto,
  ) {
    return this.service.updateResult(
      request.user.sub,
      warId,
      matchId,
      dto,
    );
  }

  @Post(':warId/complete')
  complete(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('warId')
    warId: string,
  ) {
    return this.service.completeWar(
      request.user.sub,
      warId,
    );
  }
}
