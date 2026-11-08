import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import type { Request, Response } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CommunityExceptionFilter } from '../arena/community-exception.filter.js';
import { TournamentReportDownloadService, type ReportExportKind } from './tournament-report-download.service.js';
import type { TournamentReportFormat } from './tournament-report-renderer.js';

class ExportTournamentReportDto {
  @IsIn(['pdf', 'png']) format!: TournamentReportFormat;
  @IsOptional() @IsIn(['full', 'teams']) kind?: ReportExportKind;
}

@Controller()
@UseFilters(CommunityExceptionFilter)
export class TournamentReportDownloadController {
  constructor(private readonly downloads: TournamentReportDownloadService) {}
  @Post('tournaments/:tournamentId/report/exports')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  create(@Req() request: Request & { user: AccessTokenPayload }, @Param('tournamentId', new ParseUUIDPipe()) tournamentId: string, @Body() dto: ExportTournamentReportDto) {
    return this.downloads.create(request.user, tournamentId, dto.format, dto.kind);
  }
  @Get('tournament-report-exports/:id')
  async download(@Param('id', new ParseUUIDPipe()) id: string, @Query('grant') grant: string | undefined, @Res() response: Response) {
    const report = await this.downloads.download(id, grant);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', report.contentType);
    response.setHeader('Content-Length', report.bytes.length);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    response.send(report.bytes);
  }
}
