import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ClubsService } from './clubs.service.js';
import { CreateClubDto, JoinClubDto, LinkClubEntryDto } from './clubs.dto.js';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.clubs.list(request.user.sub);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateClubDto) {
    return this.clubs.create(request.user.sub, dto);
  }

  @Post('join')
  join(@Req() request: AuthenticatedRequest, @Body() dto: JoinClubDto) {
    return this.clubs.join(request.user.sub, dto.inviteCode);
  }

  @Get(':slug')
  details(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.clubs.details(request.user.sub, slug);
  }

  @Get(':clubId/linkable-entries')
  linkableEntries(@Req() request: AuthenticatedRequest,
    @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string) {
    return this.clubs.linkableEntries(request.user.sub, clubId);
  }

  @Post(':clubId/invite/rotate')
  rotate(@Req() request: AuthenticatedRequest, @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string) {
    return this.clubs.rotateInvite(request.user.sub, clubId);
  }

  @Post(':clubId/entries')
  linkEntry(@Req() request: AuthenticatedRequest,
    @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string,
    @Body() dto: LinkClubEntryDto) {
    return this.clubs.linkEntry(request.user.sub, clubId, dto.registrationId);
  }
}
