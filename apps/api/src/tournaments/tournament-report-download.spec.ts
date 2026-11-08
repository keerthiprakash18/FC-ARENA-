import 'reflect-metadata';
import { mkdtemp, readFile, readdir, rm, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TournamentReportDownloadService } from './tournament-report-download.service.js';
import { TournamentReportRenderLimitError } from './tournament-report-renderer.js';

const user = '10000000-0000-4000-8000-000000000001', cup = '20000000-0000-4000-8000-000000000001', sid = '30000000-0000-4000-8000-000000000001';
describe('private mobile-compatible report downloads', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'arena-report-')); vi.stubEnv('TOURNAMENT_REPORT_EXPORT_DIR', root); vi.stubEnv('JWT_ACCESS_SECRET', 'test-only-tournament-report-secret'); });
  afterEach(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });
  function setup() {
    const db = { user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }) }, refreshSession: { findUnique: vi.fn().mockResolvedValue({ userId: user, revokedAt: null, expiresAt: new Date(Date.now() + 60000) }) }, $queryRaw: vi.fn().mockResolvedValue([{ attemptCount: 1 }]) };
    const reports = { assertReportAccess: vi.fn().mockResolvedValue(undefined), assertTeamListAccess: vi.fn().mockResolvedValue(undefined), getReport: vi.fn().mockResolvedValue({ tournament: { code: 'FCA-CUP' } }), getTeamList: vi.fn().mockResolvedValue({ tournament: { code: 'FCA-CUP' } }) };
    const render = vi.fn().mockImplementation(async (_report, format) => ({ bytes: format === 'pdf' ? Buffer.from('%PDF-1.4\ntest') : Buffer.from([137,80,78,71,13,10,26,10,0]), contentType: format === 'pdf' ? 'application/pdf' : 'image/png', pages: 7 }));
    return { db, reports, render, service: new TournamentReportDownloadService(db as never, reports as never, render) };
  }
  function ticket(path: string) { const url = new URL(path, 'https://example.invalid'); return { id: url.pathname.split('/').at(-1)!, grant: url.searchParams.get('grant')! }; }
  it('creates an expiring HTTPS bearer download, validates it again and returns a safe filename', async () => {
    const f = setup(), result = await f.service.create({ sub: user, sid }, cup, 'pdf'), t = ticket(result.data.path);
    expect(result.data.filename).toBe('FC-ARENA-FCA-CUP-full-report.pdf'); expect(result.data.pages).toBe(7);
    const downloaded = await f.service.download(t.id, t.grant);
    expect(downloaded.bytes.toString()).toContain('%PDF-1.4'); expect(downloaded.contentType).toBe('application/pdf');
    expect(f.db.refreshSession.findUnique).toHaveBeenCalledTimes(2); expect(f.reports.assertReportAccess).toHaveBeenCalledTimes(2);
    expect((await readdir(root))).toEqual([t.id + '.pdf']); expect(await readFile(join(root, t.id + '.pdf'))).toEqual(downloaded.bytes);
  });
  it('binds pre-completion team export to its own signed purpose, format and access check', async () => {
    const f = setup(), result = await f.service.create({ sub: user }, cup, 'png', 'teams'), t = ticket(result.data.path);
    expect(result.data.filename).toBe('FC-ARENA-FCA-CUP-full-team-list.png');
    await f.service.download(t.id, t.grant); expect(f.reports.assertTeamListAccess).toHaveBeenCalledTimes(2); expect(f.reports.getReport).not.toHaveBeenCalled();
    const [payload, signature] = t.grant.split('.'); const altered = JSON.parse(Buffer.from(payload, 'base64url').toString()); altered.kind = 'full';
    await expect(f.service.download(t.id, Buffer.from(JSON.stringify(altered)).toString('base64url') + '.' + signature)).rejects.toMatchObject({ status: 403 });
    expect(f.render.mock.calls[0][2]).toBe('teams');
  });
  it('rejects invalid, expired and cross-file grants without disclosing the file', async () => {
    const f = setup(), result = await f.service.create({ sub: user }, cup, 'pdf'), t = ticket(result.data.path);
    for (const grant of [undefined, 'invalid', t.grant + '.extra', t.grant.slice(0, -3) + 'xyz']) await expect(f.service.download(t.id, grant)).rejects.toMatchObject({ status: 403 });
    await expect(f.service.download(cup, t.grant)).rejects.toMatchObject({ status: 403 });
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 301000);
    await expect(f.service.download(t.id, t.grant)).rejects.toMatchObject({ status: 403 });
  });
  it('revokes grants after membership removal, suspended user or revoked login session', async () => {
    const f = setup(), result = await f.service.create({ sub: user, sid }, cup, 'pdf'), t = ticket(result.data.path);
    f.reports.assertReportAccess.mockRejectedValueOnce(Object.assign(new Error('Access removed'), { status: 403 }));
    await expect(f.service.download(t.id, t.grant)).rejects.toMatchObject({ status: 403 });
    f.db.user.findUnique.mockResolvedValueOnce({ status: 'SUSPENDED' }); await expect(f.service.download(t.id, t.grant)).rejects.toMatchObject({ status: 403 });
    f.db.refreshSession.findUnique.mockResolvedValueOnce(null); await expect(f.service.download(t.id, t.grant)).rejects.toMatchObject({ status: 403 });
  });
  it('enforces access and throttles before rendering; recovers after failed renders', async () => {
    const f = setup(); f.reports.assertReportAccess.mockRejectedValueOnce(Object.assign(new Error('Incomplete'), { status: 409 }));
    await expect(f.service.create({ sub: user }, cup, 'pdf')).rejects.toMatchObject({ status: 409 }); expect(f.render).not.toHaveBeenCalled();
    f.db.$queryRaw.mockResolvedValueOnce([{ attemptCount: 5 }]); await expect(f.service.create({ sub: user }, cup, 'pdf')).rejects.toMatchObject({ status: 429 });
    f.render.mockRejectedValueOnce(new TournamentReportRenderLimitError()); await expect(f.service.create({ sub: user }, cup, 'pdf')).rejects.toMatchObject({ status: 400 });
    await expect(f.service.create({ sub: user }, cup, 'pdf')).resolves.toMatchObject({ success: true });
    await expect(f.service.create({ sub: user }, cup, 'svg' as never)).rejects.toMatchObject({ status: 400 });
  });
  it('keeps unrelated files and fresh reports during bounded cleanup', async () => {
    const f = setup(), result = await f.service.create({ sub: user }, cup, 'pdf'), t = ticket(result.data.path);
    const old = '40000000-0000-4000-8000-000000000001.pdf'; await writeFile(join(root, old), 'expired'); await utimes(join(root, old), 1, 1); await writeFile(join(root, 'keep.txt'), 'keep');
    await f.service.cleanup(); expect((await readdir(root)).sort()).toEqual([t.id + '.pdf', 'keep.txt'].sort());
  });
});
