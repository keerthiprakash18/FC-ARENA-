import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { LeagueFixtureFeedService } from './league-fixture-feed.service.js';

@Controller('leagues/:leagueId/fixture-feed')
@UseGuards(JwtAuthGuard)
export class LeagueFixtureFeedController {
  constructor(private readonly feed: LeagueFixtureFeedService) {}

  @Get()
  get(@Req() request: Request & { user: AccessTokenPayload }, @Param('leagueId', new ParseUUIDPipe()) leagueId: string,
    @Query('version') version?: string) {
    return this.feed.getFeed(request.user.sub, leagueId, version);
  }
}
