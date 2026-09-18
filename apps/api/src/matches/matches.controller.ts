import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MatchesService } from './matches.service.js';

type AuthenticatedRequest =
  Request & {
    user: AccessTokenPayload;
  };

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly matchesService:
      MatchesService,
  ) {}

  @Get(':matchId')
  getMatch(
    @Req()
    request: AuthenticatedRequest,

    @Param('matchId')
    matchId: string,
  ) {
    return this.matchesService.getMatch(
      request.user.sub,
      matchId,
    );
  }
}