import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TournamentGroupEditorService } from './tournament-group-editor.service.js';
import { ApplyTournamentGroupsDto, ReorganizeTournamentGroupsDto } from './dto/reorganize-tournament-groups.dto.js';

@Controller('tournaments/:tournamentId/groups')
@UseGuards(JwtAuthGuard)
export class TournamentGroupEditorController {
  constructor(private readonly editor: TournamentGroupEditorService) {}
  @Get('editor') @Header('Cache-Control', 'private, no-store')
  get(@Req() request: Request & { user: AccessTokenPayload }, @Param('tournamentId', new ParseUUIDPipe()) id: string) { return this.editor.getEditor(request.user.sub, id); }
  @Post('reorganize/preview') @Header('Cache-Control', 'private, no-store')
  preview(@Req() request: Request & { user: AccessTokenPayload }, @Param('tournamentId', new ParseUUIDPipe()) id: string, @Body() dto: ReorganizeTournamentGroupsDto) { return this.editor.preview(request.user.sub, id, dto); }
  @Post('reorganize') @Header('Cache-Control', 'private, no-store')
  apply(@Req() request: Request & { user: AccessTokenPayload }, @Param('tournamentId', new ParseUUIDPipe()) id: string, @Body() dto: ApplyTournamentGroupsDto) { return this.editor.apply(request.user.sub, id, dto); }
}
