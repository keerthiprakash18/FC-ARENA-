import { PlayerDashboardService } from './player-dashboard.service.js';

import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import {
  memoryStorage,
} from 'multer';

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
  PlayerCareerService,
} from './player-career.service.js';

import {
  PlayerProfileImageService,
} from './player-profile-image.service.js';

import {
  UpdateProfileDto,
} from './dto/update-profile.dto.js';

type AuthenticatedRequest =
  Request & {
    user: AccessTokenPayload;
  };

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayerCareerController {
  constructor(
    private readonly dashboard: PlayerDashboardService,
    private readonly playerCareerService:
      PlayerCareerService,

    private readonly playerProfileImageService:
      PlayerProfileImageService,
  ) {}

  @Get('me/dashboard')
  myDashboard(@Req() request: AuthenticatedRequest) {
    return this.dashboard.getSummary(request.user.sub);
  }

  @Get('me/career')
  myCareer(
    @Req()
    request:
      AuthenticatedRequest,
  ): Promise<unknown> {
    return this.playerCareerService.getMyCareer(
      request.user.sub,
    );
  }

  @Patch('me/profile')
  updateMyProfile(
    @Req()
    request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.playerCareerService.updateMyProfile(
      request.user.sub,
      dto,
    );
  }


  @Post('me/profile-image')
  @UseInterceptors(
    FileInterceptor(
      'image',
      {
        storage:
          memoryStorage(),

        limits: {
          fileSize:
            5 * 1024 * 1024,
        },
      },
    ),
  )
  uploadProfileImage(
    @Req()
    request:
      AuthenticatedRequest,

    @UploadedFile()
    file:
      Express.Multer.File,
  ) {
    return this.playerProfileImageService.uploadAvatar(
      request.user.sub,
      file,
    );
  }


  @Delete('me/profile-image')
  removeProfileImage(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.playerProfileImageService.removeAvatar(
      request.user.sub,
    );
  }
}
