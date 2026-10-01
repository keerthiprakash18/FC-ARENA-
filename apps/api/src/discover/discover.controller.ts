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
  DiscoverService,
} from './discover.service.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('discover')
@UseGuards(JwtAuthGuard)
export class DiscoverController {
  constructor(
    private readonly discoverService:
      DiscoverService,
  ) {}

  @Get()
  search(
    @Req()
    request:
      AuthenticatedRequest,

    @Query('q')
    query?: string,

    @Query('type')
    type?: string,

    @Query('limit')
    limit?: string,
  ) {
    return this.discoverService.search(
      request.user.sub,
      query,
      type,
      limit,
    );
  }

  @Get('featured')
  featured(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.discoverService.featured(
      request.user.sub,
    );
  }

  @Get('hall-of-fame')
  hallOfFame(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.discoverService.hallOfFame(
      request.user.sub,
    );
  }

  @Get('players/:userId')
  player(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('userId')
    userId: string,
  ) {
    return this.discoverService.publicPlayer(
      request.user.sub,
      userId,
    );
  }
}
