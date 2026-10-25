import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateLeagueDto } from './dto/create-league.dto.js';
import { DeleteLeagueDto } from './dto/delete-league.dto.js';
import { DiscoverLeaguesDto } from './dto/discover-leagues.dto.js';
import { JoinLeagueDto } from './dto/join-league.dto.js';
import { LeagueLogoService } from './league-logo.service.js';
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
    private readonly leagueLogoService: LeagueLogoService,
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

  @Get('discover')
  discover(
    @Req() request: AuthenticatedRequest,
    @Query() dto: DiscoverLeaguesDto,
  ) {
    return this.leaguesService.discoverLeagues(request.user.sub, dto);
  }

  @Get('discover/:leagueId')
  discoverOne(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
  ) {
    return this.leaguesService.getDiscoverableLeague(request.user.sub, leagueId);
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

  @Post(':leagueId/join-request')
  requestJoinById(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
  ) {
    return this.leaguesService.requestToJoinById(request.user.sub, leagueId);
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

  @Post(':leagueId/logo')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadLogo(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.leagueLogoService.uploadLogo(request.user.sub, leagueId, file);
  }

  @Delete(':leagueId/logo')
  removeLogo(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
  ) {
    return this.leagueLogoService.removeLogo(request.user.sub, leagueId);
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

  @Delete(':leagueId')
  deleteLeague(
    @Req() request: AuthenticatedRequest,
    @Param('leagueId') leagueId: string,
    @Body() dto: DeleteLeagueDto,
  ) {
    return this.leaguesService.deleteLeague(
      request.user.sub,
      leagueId,
      dto,
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
