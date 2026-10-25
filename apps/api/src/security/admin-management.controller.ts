import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminManagementService } from './admin-management.service.js';
import { AssignResourceAdminDto } from './dto/assign-resource-admin.dto.js';
import { ReplaceResourceAdminDto } from './dto/replace-resource-admin.dto.js';
import { UpdateAdminLimitDto } from './dto/update-admin-limit.dto.js';
import { UpdateResourceAdminDto } from './dto/update-resource-admin.dto.js';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@Controller()
@UseGuards(JwtAuthGuard)
export class AdminManagementController {
  constructor(private readonly admins: AdminManagementService) {}

  @Get('leagues/:leagueId/admins')
  listLeagueAdmins(@Req() request: AuthenticatedRequest, @Param('leagueId') leagueId: string) {
    return this.admins.listAdmins(request.user.sub, 'LEAGUE', leagueId);
  }

  @Get('leagues/:leagueId/admin-candidates')
  listLeagueCandidates(@Req() request: AuthenticatedRequest, @Param('leagueId') leagueId: string, @Query('search') search?: string) {
    return this.admins.listCandidates(request.user.sub, 'LEAGUE', leagueId, search);
  }

  @Post('leagues/:leagueId/admins')
  addLeagueAdmin(@Req() request: AuthenticatedRequest, @Param('leagueId') leagueId: string, @Body() dto: AssignResourceAdminDto) {
    return this.admins.addAdmin(request.user.sub, 'LEAGUE', leagueId, dto);
  }

  @Patch('leagues/:leagueId/admins/:adminId')
  updateLeagueAdmin(@Req() request: AuthenticatedRequest, @Param('leagueId') leagueId: string, @Param('adminId') adminId: string, @Body() dto: UpdateResourceAdminDto) {
    return this.admins.updateAdmin(request.user.sub, 'LEAGUE', leagueId, adminId, dto);
  }

  @Delete('leagues/:leagueId/admins/:adminId')
  removeLeagueAdmin(@Req() request: AuthenticatedRequest, @Param('leagueId') leagueId: string, @Param('adminId') adminId: string) {
    return this.admins.removeAdmin(request.user.sub, 'LEAGUE', leagueId, adminId);
  }

  @Post('leagues/:leagueId/admins/:adminId/replace')
  replaceLeagueAdmin(@Req() request: AuthenticatedRequest, @Param('leagueId') leagueId: string, @Param('adminId') adminId: string, @Body() dto: ReplaceResourceAdminDto) {
    return this.admins.replaceAdmin(request.user.sub, 'LEAGUE', leagueId, adminId, dto);
  }

  @Patch('leagues/:leagueId/admin-settings')
  updateLeagueAdminLimit(@Req() request: AuthenticatedRequest, @Param('leagueId') leagueId: string, @Body() dto: UpdateAdminLimitDto) {
    return this.admins.updateLimit(request.user.sub, 'LEAGUE', leagueId, dto);
  }

  @Get('tournaments/:tournamentId/admins')
  listTournamentAdmins(@Req() request: AuthenticatedRequest, @Param('tournamentId') tournamentId: string) {
    return this.admins.listAdmins(request.user.sub, 'TOURNAMENT', tournamentId);
  }

  @Get('tournaments/:tournamentId/admin-candidates')
  listTournamentCandidates(@Req() request: AuthenticatedRequest, @Param('tournamentId') tournamentId: string, @Query('search') search?: string) {
    return this.admins.listCandidates(request.user.sub, 'TOURNAMENT', tournamentId, search);
  }

  @Post('tournaments/:tournamentId/admins')
  addTournamentAdmin(@Req() request: AuthenticatedRequest, @Param('tournamentId') tournamentId: string, @Body() dto: AssignResourceAdminDto) {
    return this.admins.addAdmin(request.user.sub, 'TOURNAMENT', tournamentId, dto);
  }

  @Patch('tournaments/:tournamentId/admins/:adminId')
  updateTournamentAdmin(@Req() request: AuthenticatedRequest, @Param('tournamentId') tournamentId: string, @Param('adminId') adminId: string, @Body() dto: UpdateResourceAdminDto) {
    return this.admins.updateAdmin(request.user.sub, 'TOURNAMENT', tournamentId, adminId, dto);
  }

  @Delete('tournaments/:tournamentId/admins/:adminId')
  removeTournamentAdmin(@Req() request: AuthenticatedRequest, @Param('tournamentId') tournamentId: string, @Param('adminId') adminId: string) {
    return this.admins.removeAdmin(request.user.sub, 'TOURNAMENT', tournamentId, adminId);
  }

  @Post('tournaments/:tournamentId/admins/:adminId/replace')
  replaceTournamentAdmin(@Req() request: AuthenticatedRequest, @Param('tournamentId') tournamentId: string, @Param('adminId') adminId: string, @Body() dto: ReplaceResourceAdminDto) {
    return this.admins.replaceAdmin(request.user.sub, 'TOURNAMENT', tournamentId, adminId, dto);
  }

  @Patch('tournaments/:tournamentId/admin-settings')
  updateTournamentAdminLimit(@Req() request: AuthenticatedRequest, @Param('tournamentId') tournamentId: string, @Body() dto: UpdateAdminLimitDto) {
    return this.admins.updateLimit(request.user.sub, 'TOURNAMENT', tournamentId, dto);
  }
}
