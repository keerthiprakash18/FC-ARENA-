import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ResetTournamentFixturesDto } from './dto/reset-tournament-fixtures.dto.js';
import { TournamentFixtureResetService } from './tournament-fixture-reset.service.js';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@Controller()
@UseGuards(JwtAuthGuard)
export class TournamentFixtureResetController {
  constructor(private readonly service: TournamentFixtureResetService) {}

  @Get('tournaments/:tournamentId/fixtures/reset-impact')
  impact(@Req() req: AuthenticatedRequest, @Param('tournamentId') tournamentId: string) {
    return this.service.impact(req.user.sub, tournamentId);
  }

  @Post('tournaments/:tournamentId/fixtures/reset')
  reset(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: ResetTournamentFixturesDto,
  ) {
    return this.service.reset(req.user.sub, tournamentId, dto.confirmation);
  }
}
