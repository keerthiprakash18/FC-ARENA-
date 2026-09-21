import {
  Body,
  Controller,
  Get,
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
  AiService,
} from './ai.service.js';

import {
  AiChatDto,
} from './dto/chat.dto.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService:
      AiService,
  ) {}

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('chat')
  chat(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      AiChatDto,
  ) {
    return this.aiService.chat(
      request.user.sub,
      dto,
    );
  }
}
