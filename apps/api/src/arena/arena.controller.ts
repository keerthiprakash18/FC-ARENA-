import { CommunityExceptionFilter } from './community-exception.filter.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ArenaService } from './arena.service.js';
import {
  ArenaHideDto,
  ArenaReactionDto,
  ArenaReportDto,
  ArenaVoteDto,
  CreateArenaCommentDto,
  CreateArenaPostDto,
  EditArenaCommentDto,
  EditArenaPostDto,
  ResolveArenaReportDto,
} from './arena.dto.js';

class FeedQuery {
  @IsOptional() @IsIn(['PUBLIC', 'LEAGUE']) audience?: string;
  @IsOptional() @IsUUID() leagueId?: string;
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;
}
class CommentsQuery {
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;
}
type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@UseFilters(CommunityExceptionFilter)
@Controller('arena-talk')
@UseGuards(JwtAuthGuard)
export class ArenaController {
  constructor(private readonly arena: ArenaService) {}
  @Get('context') context(@Req() request: AuthenticatedRequest) {
    return this.arena.context(request.user.sub);
  }
  @Get('posts') feed(
    @Req() request: AuthenticatedRequest,
    @Query() query: FeedQuery,
  ) {
    return this.arena.feed(
      request.user,
      query.audience ?? 'PUBLIC',
      query.leagueId,
      query.cursor,
    );
  }
  @Post('posts')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 },
    }),
  )
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateArenaPostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.arena.create(request.user, dto, file);
  }
  @Get('posts/:postId') post(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
  ) {
    return this.arena.post(request.user, id);
  }
  @Patch('posts/:postId') edit(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Body() dto: EditArenaPostDto,
  ) {
    return this.arena.editPost(request.user, id, dto);
  }
  @Delete('posts/:postId') remove(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Body() dto: ArenaHideDto,
  ) {
    return this.arena.hidePost(request.user, id, dto.reason);
  }
  @Put('posts/:postId/reaction') react(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Body() dto: ArenaReactionDto,
  ) {
    return this.arena.react(request.user, id, dto.liked);
  }
  @Put('posts/:postId/vote') vote(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Body() dto: ArenaVoteDto,
  ) {
    return this.arena.vote(request.user, id, dto.optionId);
  }
  @Get('posts/:postId/comments') comments(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Query() query: CommentsQuery,
  ) {
    return this.arena.comments(request.user, id, query.cursor);
  }
  @Post('posts/:postId/comments') comment(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateArenaCommentDto,
  ) {
    return this.arena.comment(request.user, id, dto);
  }
  @Patch('posts/:postId/comments/:commentId') editComment(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @Body() dto: EditArenaCommentDto,
  ) {
    return this.arena.editComment(request.user, id, commentId, dto.body);
  }
  @Delete('posts/:postId/comments/:commentId') removeComment(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @Body() dto: ArenaHideDto,
  ) {
    return this.arena.hideComment(request.user, id, commentId, dto.reason);
  }
  @Post('posts/:postId/report') report(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Body() dto: ArenaReportDto,
  ) {
    return this.arena.report(request.user, id, dto);
  }
  @Post('posts/:postId/comments/:commentId/report') reportComment(
    @Req() request: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @Body() dto: ArenaReportDto,
  ) {
    return this.arena.report(request.user, id, dto, commentId);
  }
  @Get('moderation/reports') reports(@Req() request: AuthenticatedRequest) {
    return this.arena.reports(request.user.sub);
  }
  @Post('moderation/reports/:reportId/resolve') resolve(
    @Req() request: AuthenticatedRequest,
    @Param('reportId', new ParseUUIDPipe()) id: string,
    @Body() dto: ResolveArenaReportDto,
  ) {
    return this.arena.resolveReport(request.user.sub, id, dto);
  }
}

@UseFilters(CommunityExceptionFilter)
@Controller('arena-talk')
export class ArenaMediaController {
  constructor(private readonly arena: ArenaService) {}
  @Get('posts/:postId/image')
  @Header('Cache-Control', 'private, no-store')
  async image(
    @Param('postId', new ParseUUIDPipe()) id: string,
    @Query('grant') grant: string | undefined,
    @Res() response: Response,
  ) {
    const data = await this.arena.image(id, grant);
    response.setHeader('Content-Type', 'image/webp');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(data);
  }
}
