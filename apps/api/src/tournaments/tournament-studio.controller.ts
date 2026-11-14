import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateStudioDraftDto, PublishStudioDto, TournamentDrawDto } from './dto/tournament-studio.dto.js';
import { TournamentStudioService } from './tournament-studio.service.js';
import { TournamentsService } from './tournaments.service.js';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@Controller()
@UseGuards(JwtAuthGuard)
export class TournamentStudioController {
  constructor(private readonly studio: TournamentStudioService, private readonly tournaments: TournamentsService) {}

  @Post('leagues/:leagueId/tournament-studio')
  create(@Req() req: AuthenticatedRequest, @Param('leagueId', new ParseUUIDPipe()) leagueId: string, @Body() dto: CreateStudioDraftDto) {
    const { requestId, ...tournament } = dto;
    return this.tournaments.createTournament(req.user.sub, leagueId, tournament, requestId);
  }

  @Get('tournaments/:tournamentId/studio')
  @Header('Cache-Control', 'private, no-store')
  get(@Req() req: AuthenticatedRequest, @Param('tournamentId', new ParseUUIDPipe()) id: string) {
    return this.studio.get(req.user.sub, id);
  }

  @Post('tournaments/:tournamentId/studio/draw')
  @Header('Cache-Control', 'private, no-store')
  draw(@Req() req: AuthenticatedRequest, @Param('tournamentId', new ParseUUIDPipe()) id: string, @Body() dto: TournamentDrawDto) {
    return this.studio.draw(req.user.sub, id, dto);
  }

  @Post('tournaments/:tournamentId/studio/publish')
  @Header('Cache-Control', 'private, no-store')
  publish(@Req() req: AuthenticatedRequest, @Param('tournamentId', new ParseUUIDPipe()) id: string, @Body() dto: PublishStudioDto) {
    return this.studio.publish(req.user.sub, id, dto);
  }

}
