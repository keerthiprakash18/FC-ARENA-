import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CommunityExceptionFilter } from '../arena/community-exception.filter.js';
import { PlayerCardExportService } from './player-card-export.service.js';
class ExportCardDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,75}\.png$/)
  filename?: string;
}
@Controller('players')
@UseFilters(CommunityExceptionFilter)
export class PlayerCardExportController {
  constructor(private readonly cards: PlayerCardExportService) {}
  @Post('me/card-export')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { files: 1, fields: 1, fileSize: 5 * 1024 * 1024 },
    }),
  )
  create(
    @Req() request: Request & { user: AccessTokenPayload },
    @Body() dto: ExportCardDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.cards.create(request.user, image, dto.filename);
  }
  @Get('card-exports/:id')
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('grant') grant: string | undefined,
    @Res() response: Response,
  ) {
    const card = await this.cards.download(id, grant);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', 'image/png');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${card.filename}"`,
    );
    response.send(card.bytes);
  }
}
