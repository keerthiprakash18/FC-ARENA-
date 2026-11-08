import { Controller, Get, Header, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TournamentReportService } from './tournament-report.service.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class TournamentReportController {
  constructor(private readonly reports: TournamentReportService) {}

  @Get('tournaments/:tournamentId/report')
  @Header('Cache-Control', 'private, no-store')
  async report(@Req() request: Request & { user: AccessTokenPayload }, @Param('tournamentId', new ParseUUIDPipe()) tournamentId: string) {
    return { success: true, data: { report: await this.reports.getReport(request.user.sub, tournamentId) }, error: null };
  }
  @Get('tournaments/:tournamentId/team-list-report')
  @Header('Cache-Control', 'private, no-store')
  async teams(@Req() request: Request & { user: AccessTokenPayload }, @Param('tournamentId', new ParseUUIDPipe()) tournamentId: string) {
    return { success: true, data: { report: await this.reports.getTeamList(request.user.sub, tournamentId) }, error: null };
  }
}
