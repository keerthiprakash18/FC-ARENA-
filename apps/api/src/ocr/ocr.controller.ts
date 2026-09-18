import {
  Body,
  Controller,
  Get,
  Param,
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
  SubmitResultDto,
} from '../results/dto/submit-result.dto.js';
import {
  OcrService,
} from './ocr.service.js';

type AuthenticatedRequest =
  Request & {
    user: AccessTokenPayload;
  };

@Controller()
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(
    private readonly ocrService:
      OcrService,
  ) {}

  @Post(
    'matches/:matchId/ocr',
  )
  @UseInterceptors(
    FileInterceptor(
      'screenshot',
      {
        storage:
          memoryStorage(),

        limits: {
          fileSize:
            10 * 1024 * 1024,
        },
      },
    ),
  )
  uploadScreenshot(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('matchId')
    matchId: string,

    @UploadedFile()
    file:
      Express.Multer.File,
  ) {
    return this.ocrService.uploadScreenshot(
      request.user.sub,
      matchId,
      file,
    );
  }

  @Get(
    'matches/:matchId/ocr/latest',
  )
  latest(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('matchId')
    matchId: string,
  ) {
    return this.ocrService.getLatestExtraction(
      request.user.sub,
      matchId,
    );
  }

  @Post(
    'ocr/:ocrExtractionId/submit-result',
  )
  submitOcrResult(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'ocrExtractionId',
    )
    ocrExtractionId: string,

    @Body()
    dto: SubmitResultDto,
  ) {
    return this.ocrService.submitOcrResult(
      request.user.sub,
      ocrExtractionId,
      dto,
    );
  }
}