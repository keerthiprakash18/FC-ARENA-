import {
  Body,
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
  CreateFairPlayAppealDto,
} from './dto/create-fair-play-appeal.dto.js';

import {
  IssueFairPlayEventDto,
} from './dto/issue-fair-play-event.dto.js';

import {
  ResolveFairPlayAppealDto,
} from './dto/resolve-fair-play-appeal.dto.js';

import {
  RevokeFairPlayEventDto,
} from './dto/revoke-fair-play-event.dto.js';

import {
  FairPlayService,
} from './fair-play.service.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('fair-play')
@UseGuards(JwtAuthGuard)
export class FairPlayController {
  constructor(
    private readonly fairPlay:
      FairPlayService,
  ) {}

  @Get('me')
  me(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.fairPlay.getMyFairPlay(
      request.user.sub,
    );
  }

  @Get('players/:userId')
  playerSummary(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('userId')
    userId: string,
  ) {
    return this.fairPlay.getPublicSummary(
      request.user.sub,
      userId,
    );
  }

  @Post('events/:eventId/appeal')
  appeal(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('eventId')
    eventId: string,

    @Body()
    dto:
      CreateFairPlayAppealDto,
  ) {
    return this.fairPlay.createAppeal(
      request.user.sub,
      eventId,
      dto,
    );
  }
}

@Controller('admin/fair-play')
@UseGuards(JwtAuthGuard)
export class FairPlayAdminController {
  constructor(
    private readonly fairPlay:
      FairPlayService,
  ) {}

  @Get()
  queue(
    @Req()
    request:
      AuthenticatedRequest,

    @Query('leagueId')
    leagueId?: string,
  ) {
    return this.fairPlay.getAdminQueue(
      request.user.sub,
      leagueId,
    );
  }

  @Get('members')
  members(
    @Req()
    request:
      AuthenticatedRequest,

    @Query('leagueId')
    leagueId: string,

    @Query('search')
    search?: string,
  ) {
    return this.fairPlay.getLeagueMembersForAdmin(
      request.user.sub,
      leagueId,
      search,
    );
  }

  @Post('events')
  issue(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      IssueFairPlayEventDto,
  ) {
    return this.fairPlay.issueEvent(
      request.user.sub,
      dto,
    );
  }

  @Post('events/:eventId/revoke')
  revoke(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('eventId')
    eventId: string,

    @Body()
    dto:
      RevokeFairPlayEventDto,
  ) {
    return this.fairPlay.revokeEvent(
      request.user.sub,
      eventId,
      dto,
    );
  }

  @Post('appeals/:appealId/resolve')
  resolveAppeal(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('appealId')
    appealId: string,

    @Body()
    dto:
      ResolveFairPlayAppealDto,
  ) {
    return this.fairPlay.resolveAppeal(
      request.user.sub,
      appealId,
      dto,
    );
  }
}
