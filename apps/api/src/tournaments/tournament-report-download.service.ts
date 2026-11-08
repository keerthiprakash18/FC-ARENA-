import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaService } from '../database/prisma.service.js';
import { TournamentReportService } from './tournament-report.service.js';
import { renderTournamentReport, renderTournamentTeamList, TournamentReportRenderLimitError, type RenderedTournamentReport, type TournamentReportFormat } from './tournament-report-renderer.js';
import type { TournamentReport, TournamentTeamList } from './tournament-report.types.js';

export interface ReportExportViewer { sub: string; sid?: string }
export type ReportExportKind = 'full' | 'teams';
interface ReportExportGrant extends ReportExportViewer { v: 1; id: string; tournamentId: string; format: TournamentReportFormat; kind: ReportExportKind; filename: string; expiresAt: number }
type Renderer = (report: TournamentReport | TournamentTeamList, format: TournamentReportFormat, kind: ReportExportKind) => Promise<RenderedTournamentReport>;
export const TOURNAMENT_REPORT_RENDERER = 'TOURNAMENT_REPORT_RENDERER';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png)$/i;
const FILENAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,110}\.(pdf|png)$/;
const TTL = 5 * 60_000;
const MIME = { pdf: 'application/pdf', png: 'image/png' } as const;

@Injectable()
export class TournamentReportDownloadService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TournamentReportDownloadService.name);
  private timer?: ReturnType<typeof setInterval>;
  private rendering = false;
  private readonly renderer: Renderer;
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: TournamentReportService,
    @Optional() @Inject(TOURNAMENT_REPORT_RENDERER) renderer?: Renderer,
  ) { this.renderer = renderer ?? ((report, format, kind) => kind === 'teams' ? renderTournamentTeamList(report as TournamentTeamList, format) : renderTournamentReport(report as TournamentReport, format)); }

  private root() { return resolve(process.env.TOURNAMENT_REPORT_EXPORT_DIR ?? 'storage/tournament-report-exports'); }
  private path(id: string, format: TournamentReportFormat) {
    if (!UUID.test(id) || !['pdf', 'png'].includes(format)) throw new NotFoundException('This report download is unavailable.');
    return resolve(this.root(), `${id}.${format}`);
  }
  private sign(payload: string) {
    if (!process.env.JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is missing.');
    return createHmac('sha256', process.env.JWT_ACCESS_SECRET).update('tournament-report-export:' + payload).digest('base64url');
  }
  private async active(viewer: ReportExportViewer) {
    const user = await this.prisma.user.findUnique({ where: { id: viewer.sub }, select: { status: true } });
    if (!user || user.status !== 'ACTIVE') throw new ForbiddenException('This report download is no longer available.');
    if (viewer.sid) {
      const session = await this.prisma.refreshSession.findUnique({ where: { id: viewer.sid }, select: { userId: true, revokedAt: true, expiresAt: true } });
      if (!session || session.userId !== viewer.sub || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw new ForbiddenException('Sign in again to prepare a report download.');
    }
  }
  private async rate(viewer: ReportExportViewer) {
    const keyHash = createHash('sha256').update('tournament-report-export:' + viewer.sub).digest('hex');
    const limits = await this.prisma.$queryRaw<{ attemptCount: number }[]>`
      INSERT INTO auth_rate_limits (action, "keyHash", "windowStartedAt", "attemptCount", "updatedAt")
      VALUES ('TOURNAMENT_REPORT_EXPORT', ${keyHash}, (NOW() AT TIME ZONE 'UTC'), 1, (NOW() AT TIME ZONE 'UTC'))
      ON CONFLICT (action, "keyHash") DO UPDATE SET
        "attemptCount" = CASE WHEN auth_rate_limits."windowStartedAt" <= (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 minute' THEN 1 ELSE LEAST(auth_rate_limits."attemptCount" + 1, 5) END,
        "windowStartedAt" = CASE WHEN auth_rate_limits."windowStartedAt" <= (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 minute' THEN (NOW() AT TIME ZONE 'UTC') ELSE auth_rate_limits."windowStartedAt" END,
        "updatedAt" = (NOW() AT TIME ZONE 'UTC') RETURNING "attemptCount"`;
    if (!limits[0] || limits[0].attemptCount > 4) throw new HttpException({ success: false, data: null, error: { code: 'REPORT_EXPORT_RATE_LIMIT', message: 'Several reports were prepared recently. Wait a minute and try again.' } }, 429);
  }

  async create(viewer: ReportExportViewer, tournamentId: string, format: TournamentReportFormat, kind: ReportExportKind = 'full') {
    if (!['pdf', 'png'].includes(format)) throw new BadRequestException('Choose PDF or PNG for this report.');
    if (!['full', 'teams'].includes(kind)) throw new BadRequestException('Choose a tournament report or team list.');
    await this.active(viewer);
    await (kind === 'teams' ? this.reports.assertTeamListAccess(viewer.sub, tournamentId) : this.reports.assertReportAccess(viewer.sub, tournamentId));
    if (this.rendering) throw new HttpException({ success: false, data: null, error: { code: 'REPORT_EXPORT_BUSY', message: 'Another report is being prepared. Try again shortly.' } }, 429);
    this.rendering = true;
    try {
      await this.rate(viewer);
      const report = await (kind === 'teams' ? this.reports.getTeamList(viewer.sub, tournamentId) : this.reports.getReport(viewer.sub, tournamentId));
      const output = await this.renderer(report, format, kind);
      const max = format === 'pdf' ? 48 * 1024 * 1024 : 10 * 1024 * 1024;
      if (!output.bytes.length || output.bytes.length > max || output.contentType !== MIME[format] ||
        (format === 'pdf' ? output.bytes.subarray(0, 5).toString() !== '%PDF-' : !output.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))) throw new BadRequestException('The report could not be prepared. Please try again.');
      const id = randomUUID(), expiresAt = Date.now() + TTL;
      const code = report.tournament.code.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 65) || 'tournament';
      const filename = `FC-ARENA-${code}-${kind === 'teams' ? 'full-team-list' : format === 'pdf' ? 'full-report' : 'champions'}.${format}`;
      await mkdir(this.root(), { recursive: true, mode: 0o700 });
      await writeFile(this.path(id, format), output.bytes, { mode: 0o600, flag: 'wx' });
      const grant: ReportExportGrant = { v: 1, id, tournamentId, sub: viewer.sub, ...(viewer.sid ? { sid: viewer.sid } : {}), format, kind, filename, expiresAt };
      const payload = Buffer.from(JSON.stringify(grant)).toString('base64url');
      return { success: true, data: { path: `/tournament-report-exports/${id}?grant=${payload}.${this.sign(payload)}`, filename, expiresAt: new Date(expiresAt).toISOString(), pages: output.pages }, error: null };
    } catch (error) {
      if (error instanceof TournamentReportRenderLimitError) throw new BadRequestException({ success: false, data: null, error: { code: 'REPORT_EXPORT_TOO_LARGE', message: error.message } });
      throw error;
    } finally { this.rendering = false; }
  }

  async download(id: string, raw?: string) {
    let grant: ReportExportGrant;
    try {
      if (!UUID.test(id) || !raw || raw.length > 1800) throw new Error();
      const [payload, signature, extra] = raw.split('.');
      if (!payload || !signature || extra) throw new Error();
      const expected = Buffer.from(this.sign(payload)), actual = Buffer.from(signature);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error();
      grant = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ReportExportGrant;
      if (grant.v !== 1 || grant.id !== id || !UUID.test(grant.tournamentId) || typeof grant.sub !== 'string' || !UUID.test(grant.sub) ||
        (grant.sid !== undefined && (typeof grant.sid !== 'string' || !UUID.test(grant.sid))) || !['pdf', 'png'].includes(grant.format) ||
        !['full', 'teams'].includes(grant.kind) || !FILENAME.test(grant.filename) || !grant.filename.endsWith('.' + grant.format) || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now() || grant.expiresAt > Date.now() + TTL + 5000) throw new Error();
    } catch { throw new ForbiddenException('This report link has expired or is invalid. Create a new download from the report page.'); }
    await this.active(grant);
    // Short bearer grants are usable by Android's external browser, but revoked
    // sessions, memberships and completion status are checked again on download.
    await (grant.kind === 'teams' ? this.reports.assertTeamListAccess(grant.sub, grant.tournamentId) : this.reports.assertReportAccess(grant.sub, grant.tournamentId));
    try {
      const path = this.path(id, grant.format), file = await stat(path);
      if (!file.isFile() || file.size > (grant.format === 'pdf' ? 48 : 10) * 1024 * 1024) throw new NotFoundException('This report download is unavailable.');
      return { bytes: await readFile(path), filename: grant.filename, contentType: MIME[grant.format] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException('This report has expired. Create a new download from the report page.');
      throw error;
    }
  }
  onModuleInit() {
    if (process.env.TOURNAMENT_REPORT_EXPORT_CLEANUP_ENABLED === 'false') return;
    const clean = () => { void this.cleanup().catch(() => this.logger.warn('Temporary tournament report cleanup failed.')); };
    clean(); this.timer = setInterval(clean, 10 * 60_000); this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async cleanup() {
    const entries = await readdir(this.root(), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
    for (const entry of entries) {
      if (!entry.isFile() || !FILE_KEY.test(entry.name)) continue;
      const path = resolve(this.root(), entry.name);
      try { if ((await stat(path)).mtimeMs < Date.now() - TTL - 60_000) await unlink(path); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
}
