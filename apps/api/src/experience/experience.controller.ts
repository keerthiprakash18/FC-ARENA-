import { CommunityExceptionFilter } from '../arena/community-exception.filter.js';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ExperienceService } from './experience.service.js';
import { PLAYER_FRAMES, type PlayerFrame } from './experience-policy.js';

class SelectFrameDto {
  @IsIn(PLAYER_FRAMES.map((frame) => frame.id))
  frame!: PlayerFrame;
}
type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@UseFilters(CommunityExceptionFilter)
@Controller('experience')
@UseGuards(JwtAuthGuard)
export class ExperienceController {
  constructor(private readonly experience: ExperienceService) {}
  @Get('me')
  mine(@Req() request: AuthenticatedRequest) {
    return this.experience.getMine(request.user.sub);
  }
  @Patch('me/frame')
  frame(@Req() request: AuthenticatedRequest, @Body() dto: SelectFrameDto) {
    return this.experience.selectFrame(request.user.sub, dto.frame);
  }
  @Get('players/:userId')
  player(
    @Req() request: AuthenticatedRequest,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.experience.publicSummary(request.user.sub, userId);
  }
}
