import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateLeagueDto } from './dto/create-league.dto.js';
import { JoinLeagueDto } from './dto/join-league.dto.js';
import { LeagueManagementService } from './league-management.service.js';
import { LeaguesService } from './leagues.service.js';

type AuthenticatedRequest = Request & {
  user: AccessTokenPayload;
};

@Controller('leagues')
@UseGuards(JwtAuthGuard)
export class LeaguesController {
  constructor(
    private readonly leaguesService: LeaguesService,
    private readonly managementService: LeagueManagementService,
  ) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateLeagueDto,
  ) {
    return this.leaguesService.createLeague(
      request.user.sub,
      dto,
    );
  }

  @Get('my')
  getMyLeagues(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.leaguesService.getMyLeagues(
      request.user.sub,
    );
  }

  @Get('code/:code')
  preview(
    @Req() request: AuthenticatedRequest,
    @Param('code') code: string,
  ) {
    return this.leaguesService.previewByCode(
      request.user.sub,
      code,
    );
  }

  @Post('join')
  join(
    @Req() request: AuthenticatedRequest,
    @Body() dto: JoinLeagueDto,
  ) {
    return this.leaguesService.requestToJoin(
      request.user.sub,
      dto.code,
    );
  }

  @Get(':leagueId')
  getLeagueHome(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
  ) {
    return this.managementService.getLeagueHome(
      request.user.sub,
      leagueId,
    );
  }

  @Get(':leagueId/members')
  getMembers(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
    @Query('search') search?: string,
  ) {
    return this.managementService.getMembers(
      request.user.sub,
      leagueId,
      search,
    );
  }

  @Delete(':leagueId/members/:memberUserId')
  removeMember(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.managementService.removeMember(
      request.user.sub,
      leagueId,
      memberUserId,
    );
  }

  @Get(':leagueId/applications')
  applications(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
  ) {
    return this.leaguesService.getApplications(
      request.user.sub,
      leagueId,
    );
  }

  @Post(':leagueId/applications/:applicationId/approve')
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.leaguesService.approveApplication(
      request.user.sub,
      leagueId,
      applicationId,
    );
  }

  @Post(':leagueId/applications/:applicationId/reject')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.leaguesService.rejectApplication(
      request.user.sub,
      leagueId,
      applicationId,
    );
  }

  @Post(':leagueId/set-primary')
  setPrimary(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
  ) {
    return this.leaguesService.setPrimary(
      request.user.sub,
      leagueId,
    );
  }

  @Delete(':leagueId/leave')
  leave(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
  ) {
    return this.leaguesService.leaveLeague(
      request.user.sub,
      leagueId,
    );
  }
}