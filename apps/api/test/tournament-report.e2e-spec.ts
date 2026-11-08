import 'reflect-metadata';
import { randomUUID, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { SecurityModule } from '../src/security/security.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { TournamentsModule } from '../src/tournaments/tournaments.module.js';
import { configureHttpSecurity } from '../src/security/http-security.js';

describe('full tournament and team exports on real PostgreSQL and authenticated HTTP', () => {
  const run = randomUUID().slice(0, 8); let app: INestApplication, db: PrismaService, owner: string, outsider: string, cup: string, openCup: string, league: string, token: string, outsideToken: string;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw Error('Requires disposable loopback *_test database.');
    process.env.TOURNAMENT_REPORT_EXPORT_DIR = resolve('../../.cache/tournament-report/exports-' + run); process.env.TOURNAMENT_REPORT_EXPORT_CLEANUP_ENABLED = 'false';
    app = (await Test.createTestingModule({ imports: [PrismaModule, SecurityModule, AuthModule, TournamentsModule] }).compile()).createNestApplication();
    configureHttpSecurity(app); await app.init(); db = app.get(PrismaService);
    const ids = [];
    for (let n = 0; n < 2; n++) ids.push((await db.user.create({ data: { email: `report-${run}-${n}@example.invalid`, fullName: 'Report test ' + n, passwordHash: 'not-a-login-hash', status: 'ACTIVE' } })).id);
    [owner, outsider] = ids;
    league = (await db.league.create({ data: { name: 'Report test league', code: 'RP' + run, creatorUserId: owner } })).id;
    await db.leagueMember.create({ data: { leagueId: league, userId: owner, type: 'PRIMARY' } });
    const sign = (sub: string) => new JwtService().sign({ sub, email: 'test@example.invalid', role: 'USER', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: 600 }); token = sign(owner); outsideToken = sign(outsider);
    for (let i = 0; i < 2; i++) {
      const t = await db.tournament.create({ data: { leagueId: league, createdByUserId: owner, name: 'International report ' + i, code: 'RP-' + run + i, mode: 'SOLO', format: 'ROUND_ROBIN', teamSize: 1, maxEntries: 8, status: i ? 'REGISTRATION_OPEN' : 'COMPLETED', completedAt: i ? null : new Date() } });
      if (i) openCup = t.id; else cup = t.id;
      const entries = [];
      for (let j = 0; j < 2; j++) entries.push(await db.tournamentRegistration.create({ data: { tournamentId: t.id, registeredByUserId: owner, entryName: j ? 'France & Friends' : 'தமிழ் வீரர்கள்', status: 'APPROVED', sortOrder: j, members: j ? undefined : { create: { tournamentId: t.id, userId: owner } } } }));
      await db.tournamentRegistration.create({ data: { tournamentId: t.id, registeredByUserId: outsider, entryName: 'Pending team excluded', status: 'PENDING' } });
      if (!i) {
        const fixture = await db.fixture.create({ data: { tournamentId: t.id, fixtureCode: 'RP-F-' + run, sequence: 1, roundNumber: 1, roundName: 'Final league round', bracketPosition: 1, homeRegistrationId: entries[0].id, awayRegistrationId: entries[1].id, status: 'COMPLETED' } });
        const match = await db.match.create({ data: { tournamentId: t.id, fixtureId: fixture.id, status: 'COMPLETED' } });
        const result = await db.resultSubmission.create({ data: { matchId: match.id, submittedByUserId: owner, homeScore: 3, awayScore: 1, status: 'CONFIRMED', reviewedAt: new Date() } });
        await db.match.update({ where: { id: match.id }, data: { confirmedResultSubmissionId: result.id } });
        await db.tournamentSummary.create({ data: { tournamentId: t.id, publishedByUserId: owner, snapshot: { placements: { champion: { registrationId: entries[0].id, name: entries[0].entryName }, runnerUp: { registrationId: entries[1].id, name: entries[1].entryName }, thirdPlace: [] } } } });
      }
    }
  }, 60000);
  beforeEach(async () => { await db.authRateLimit.deleteMany({ where: { action: 'TOURNAMENT_REPORT_EXPORT', keyHash: createHash('sha256').update('tournament-report-export:' + owner).digest('hex') } }); });
  afterAll(async () => { await app?.close(); });
  const get = (id: string, suffix = 'report', bearer = token) => request(app.getHttpServer()).get(`/api/tournaments/${id}/${suffix}`).set('Authorization', 'Bearer ' + bearer);
  const prepare = (id: string, body: object) => request(app.getHttpServer()).post(`/api/tournaments/${id}/report/exports`).set('Authorization', 'Bearer ' + token).send(body);
  it('guards private data, validates IDs, and unlocks the recap only after completion', async () => {
    await request(app.getHttpServer()).get(`/api/tournaments/${cup}/report`).expect(401);
    await get(cup, 'report', outsideToken).expect(403); await get(openCup).expect(409); await get('invalid').expect(400);
    const response = await get(cup).expect(200); expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body.data.report).toMatchObject({ overview: { teams: 2, players: 1, totalGoals: 4, verifiedMatches: 1 }, placements: { champion: { name: 'தமிழ் வீரர்கள்' }, source: 'PUBLISHED' }, matches: [{ score: { home: 3, away: 1 } }] });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|example.invalid|Pending team excluded/);
  });
  it('provides an approved-only roster for a tournament still accepting registrations', async () => {
    const response = await get(openCup, 'team-list-report').expect(200);
    expect(response.body.data.report.overview).toEqual({ teams: 2, players: 1, groups: 0, pending: 1 });
    await get(openCup, 'team-list-report', outsideToken).expect(403);
  });
  it('creates real PDF and PNG attachments usable without Android browser auth cookies', async () => {
    for (const [id, kind, format] of [[cup, 'full', 'pdf'], [cup, 'full', 'png'], [openCup, 'teams', 'pdf'], [openCup, 'teams', 'png']]) {
      const response = await prepare(id, { kind, format }).expect(201);
      const file = await request(app.getHttpServer()).get('/api' + response.body.data.path).expect(200);
      expect(file.headers['content-type']).toContain(format === 'pdf' ? 'application/pdf' : 'image/png'); expect(file.headers['content-disposition']).toContain('attachment; filename="FC-ARENA-'); expect(file.headers['cache-control']).toContain('no-store');
      expect(file.body.length).toBeGreaterThan(1000); if (format === 'pdf') expect(file.body.subarray(0, 5).toString()).toBe('%PDF-');
    }
  }, 60000);
  it('rejects malformed export options, incomplete full reports and unsigned links', async () => {
    await prepare(cup, { format: 'svg' }).expect(400); await prepare(cup, { format: 'pdf', kind: 'anything' }).expect(400); await prepare(openCup, { format: 'pdf' }).expect(409);
    await request(app.getHttpServer()).get('/api/tournament-report-exports/' + randomUUID()).expect(403);
  });
  it('invalidates a prepared team download when its league membership is removed', async () => {
    const response = await prepare(openCup, { kind: 'teams', format: 'pdf' }).expect(201);
    await db.leagueMember.delete({ where: { leagueId_userId: { leagueId: league, userId: owner } } });
    await request(app.getHttpServer()).get('/api' + response.body.data.path).expect(403);
  });
});
