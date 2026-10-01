import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
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
  AdminOpsService,
} from './admin-ops.service.js';

import {
  BackupReportDto,
} from './dto/backup-report.dto.js';

import {
  CreateAndroidReleaseDto,
} from './dto/create-android-release.dto.js';

import {
  UpdateAndroidReleaseDto,
} from './dto/update-android-release.dto.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('admin/ops')
@UseGuards(JwtAuthGuard)
export class AdminOpsController {
  constructor(
    private readonly adminOps:
      AdminOpsService,
  ) {}

  @Get('overview')
  overview(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.adminOps.overview(
      request.user.sub,
    );
  }

  @Get('system')
  system(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.adminOps.system(
      request.user.sub,
    );
  }

  @Get('android/releases')
  releases(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.adminOps.listAndroidReleases(
      request.user.sub,
    );
  }

  @Post('android/releases')
  createRelease(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      CreateAndroidReleaseDto,
  ) {
    return this.adminOps.createAndroidRelease(
      request.user.sub,
      dto,
    );
  }

  @Patch(
    'android/releases/:releaseId',
  )
  updateRelease(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('releaseId')
    releaseId:
      string,

    @Body()
    dto:
      UpdateAndroidReleaseDto,
  ) {
    return this.adminOps.updateAndroidRelease(
      request.user.sub,
      releaseId,
      dto,
    );
  }

  @Post(
    'android/releases/:releaseId/publish',
  )
  publishRelease(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('releaseId')
    releaseId:
      string,
  ) {
    return this.adminOps.publishAndroidRelease(
      request.user.sub,
      releaseId,
    );
  }
}

@Controller('mobile/android')
export class MobileVersionController {
  constructor(
    private readonly adminOps:
      AdminOpsService,
  ) {}

  @Get('version')
  version(
    @Query('versionCode')
    versionCode?:
      string,
  ) {
    return this.adminOps.androidVersionPolicy(
      versionCode,
    );
  }
}

@Controller('internal/ops/backups')
export class BackupReportController {
  constructor(
    private readonly adminOps:
      AdminOpsService,
  ) {}

  @Post('report')
  report(
    @Headers(
      'x-backup-report-token',
    )
    token:
      string | undefined,

    @Body()
    dto:
      BackupReportDto,
  ) {
    return this.adminOps.recordBackup(
      token,
      dto,
    );
  }
}
