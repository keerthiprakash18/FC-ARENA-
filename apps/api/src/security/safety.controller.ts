import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type {
  Request,
} from 'express';

import type {
  AccessTokenPayload,
} from '../auth/auth.types.js';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
  BlockUserDto,
} from './dto/block-user.dto.js';

import {
  ReportUserContentDto,
} from './dto/report-user-content.dto.js';

import {
  ResolveSafetyReportDto,
} from './dto/resolve-safety-report.dto.js';

import {
  SafetyService,
} from './safety.service.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('safety')
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(
    private readonly safetyService:
      SafetyService,
  ) {}

  @Post('reports')
  reportUserContent(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      ReportUserContentDto,
  ) {
    return this.safetyService.reportUserContent(
      request.user.sub,
      dto,
    );
  }

  @Get('reports/mine')
  myReports(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.safetyService.getMyReports(
      request.user.sub,
    );
  }

  @Post('blocks')
  blockUser(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      BlockUserDto,
  ) {
    return this.safetyService.blockUser(
      request.user.sub,
      dto,
    );
  }

  @Get('blocks')
  blockedUsers(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.safetyService.getBlockedUsers(
      request.user.sub,
    );
  }

  @Delete(
    'blocks/:targetUserId',
  )
  unblockUser(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('targetUserId')
    targetUserId: string,
  ) {
    return this.safetyService.unblockUser(
      request.user.sub,
      targetUserId,
    );
  }

  @Get('admin/reports')
  adminReports(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.safetyService.getAdminReports(
      request.user.sub,
    );
  }

  @Post(
    'admin/reports/:reportId/resolve',
  )
  resolveReport(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('reportId')
    reportId: string,

    @Body()
    dto:
      ResolveSafetyReportDto,
  ) {
    return this.safetyService.resolveReport(
      request.user.sub,
      reportId,
      dto,
    );
  }
}
