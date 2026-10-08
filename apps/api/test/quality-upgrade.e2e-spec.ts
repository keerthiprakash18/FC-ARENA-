import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { configureHttpSecurity } from '../src/security/http-security.js';
import { AuthService } from '../src/auth/auth.service.js';
import { ResultsService } from '../src/results/results.service.js';
import { ResultCorrectionService } from '../src/results/result-correction.service.js';
import { TournamentsService } from '../src/tournaments/tournaments.service.js';
import { FixturesService } from '../src/tournaments/fixtures.service.js';
import { PlayoffsService } from '../src/tournaments/playoffs.service.js';
import { AchievementsService } from '../src/achievements/achievements.service.js';
import { LeagueWarsService } from '../src/league-wars/league-wars.service.js';
import { RankingsService } from '../src/rankings/rankings.service.js';
import { OcrService } from '../src/ocr/ocr.service.js';

describe('Quality upgrade: real database and HTTP invariants', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let results: ResultsService;
  let corrections: ResultCorrectionService;
  let tournaments: TournamentsService;
  let fixtures: FixturesService;
  let awards: AchievementsService;
  let wars: LeagueWarsService;
  const run = randomUUID().slice(0, 8);
  const password = 'Quality-Only-Password-42!';
  const users: Array<{ id: string; email: string; token: string; cookie: string }> = [];
  let league: { id: string; code: string };
  let otherLeague: { id: string; code: string };

  const post = (path: string, user = 0, body: object = {}) => request(app.getHttpServer())
    .post(`/api/${path}`).set('Authorization', `Bearer ${users[user].token}`).send(body);
  const get = (path: string, user = 0) => request(app.getHttpServer())
    .get(`/api/${path}`).set('Authorization', `Bearer ${users[user].token}`);

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    // Existing GitHub jobs provision a fresh service database named fcarena.
    // Local execution requires the explicit disposable *_test database name.
    const disposableName = url.pathname.endsWith('_test') ||
      (process.env.GITHUB_ACTIONS === 'true' && url.pathname === '/fcarena');
    const redis = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;
    if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !disposableName || process.env.REDIS_HOST !== '127.0.0.1' ||
      (redis && !['127.0.0.1', 'localhost', '[::1]'].includes(redis.hostname))) {
      throw new Error('Quality E2E requires a disposable loopback *_test PostgreSQL database and local Redis.');
    }
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureHttpSecurity(app);
    await app.init();
    prisma = app.get(PrismaService);
    // This guarded, dedicated database is disposable. Reset only the shared
    // registration/IP buckets at suite start; the test still exercises the
    // actual configured limits (the sixth valid registration must fail).
    await prisma.authRateLimit.deleteMany({ where: { action: { in: ['REGISTER_IP', 'LOGIN_IP'] } } });
    auth = app.get(AuthService);
    results = app.get(ResultsService);
    corrections = app.get(ResultCorrectionService);
    tournaments = app.get(TournamentsService);
    fixtures = app.get(FixturesService);
    awards = app.get(AchievementsService);
    wars = app.get(LeagueWarsService);
    for (let index = 0; index < 5; index++) {
      const email = `quality-${run}-${index}@example.test`;
      const registered = await request(app.getHttpServer()).post('/api/auth/register').send({
        email, fullName: `Quality ${index}`, inGameName: `Quality${run}${index}`,
        password, confirmPassword: password,
      }).expect(201);
      expect(registered.body.data.user.status).toBe('ACTIVE');
      expect(JSON.stringify(registered.body)).not.toContain('passwordHash');
      const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password }).expect(200);
      expect(login.body.data.refreshToken).toBeUndefined();
      const cookie = login.headers['set-cookie'][0].split(';')[0];
      expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(login.headers['set-cookie'][0]).toContain('Path=/api/auth');
      users.push({ id: registered.body.data.user.id, email, token: login.body.data.accessToken, cookie });
    }
    league = (await post('leagues', 0, { name: `Quality ${run}` }).expect(201)).body.data.league;
    otherLeague = (await post('leagues', 1, { name: `Other ${run}` }).expect(201)).body.data.league;
  }, 60_000);

  afterAll(async () => { await app?.close(); }, 30_000);
  // Synthetic records intentionally remain in this disposable cluster for
  // inspection. Teardown stops/drops the entire test cluster, never shared data.

  async function tournament(format: 'LEAGUE_ROUND_ROBIN' | 'DOUBLE_ROUND_ROBIN' | 'SINGLE_ELIMINATION', size = 2) {
    const created = await tournaments.createTournament(users[0].id, league.id, {
      name: `Quality ${format} ${randomUUID().slice(0, 6)}`, mode: 'SOLO', competitionFormat: format, maxEntries: 8,
    });
    const id = created.data.tournament.id;
    for (const user of users.slice(2, 2 + size)) {
      await prisma.tournamentRegistration.create({ data: {
        tournamentId: id, registeredByUserId: user.id, entryName: user.email,
        status: 'APPROVED', members: { create: { tournamentId: id, userId: user.id } },
      } });
    }
    await prisma.tournament.update({ where: { id }, data: { status: 'REGISTRATION_CLOSED' } });
    return id;
  }

  async function record(matchId: string, homeScore = 2, awayScore = 0) {
    const submitted = await results.submitResult(users[0].id, matchId, { homeScore, awayScore });
    await results.confirmResult(users[0].id, submitted.data.submission.id);
    return submitted.data.submission.id;
  }

  it('runs registration → league request → admin approval → tournament entry → fixtures → results → standings with cross-scope denials', async () => {
    await request(app.getHttpServer()).get('/api/leagues/my').expect(401);
    await get(`leagues/${league.id}/members`, 1).expect(403);
    for (const index of [2, 3, 4]) {
      const application = (await post('leagues/join', index, { code: league.code }).expect(201)).body.data.application;
      await post(`leagues/${league.id}/applications/${application.id}/approve`, index).expect(403);
      await post(`leagues/${otherLeague.id}/applications/${application.id}/approve`, 1).expect(404);
      await post(`leagues/${league.id}/applications/${application.id}/approve`, 0).expect(201);
    }
    const created = await post(`leagues/${league.id}/tournaments`, 0, {
      name: `Lifecycle ${run}`, mode: 'SOLO', competitionFormat: 'DOUBLE_ROUND_ROBIN', maxEntries: 4,
    }).expect(201);
    const id = created.body.data.tournament.id;
    expect(created.body.data.tournament).toMatchObject({ format: 'ROUND_ROBIN', legType: 'HOME_AWAY' });
    await post(`tournaments/${id}/open-registration`, 1).expect(403);
    await post(`tournaments/${id}/open-registration`).expect(201);
    await post(`tournaments/${id}/register`, 1).expect(403);
    for (const index of [2, 3]) {
      const entry = (await post(`tournaments/${id}/register`, index).expect(201)).body.data.registration;
      await post(`tournaments/${id}/registrations/${entry.id}/approve`, index).expect(403);
      await post(`tournaments/${id}/registrations/${entry.id}/approve`).expect(201);
    }
    await post(`tournaments/${id}/close-registration`).expect(201);
    await post(`tournaments/${id}/fixtures/generate`, 2).expect(403);
    for (const [scopeType, scopeId] of [['GLOBAL', '*'], ['LEAGUE', league.id], ['TOURNAMENT', id]]) {
      await post('security/roles', 2, { userId: users[4].id, role: 'TOURNAMENT_ADMIN', scopeType, scopeId }).expect(403);
      await post('security/roles', 1, { userId: users[4].id, role: 'TOURNAMENT_ADMIN', scopeType, scopeId }).expect(403);
    }
    const delegated = await post('security/roles', 0, { userId: users[4].id, role: 'TOURNAMENT_ADMIN', scopeType: 'TOURNAMENT', scopeId: id }).expect(201);
    await request(app.getHttpServer()).delete(`/api/security/roles/${delegated.body.data.assignment.id}`)
      .set('Authorization', `Bearer ${users[1].token}`).expect(403);
    expect(await prisma.roleAssignment.count({ where: { id: delegated.body.data.assignment.id } })).toBe(1);
    await post(`tournaments/${id}/fixtures/generate`, 4).expect(201);
    const otherTournament = await tournament('LEAGUE_ROUND_ROBIN');
    await post(`tournaments/${otherTournament}/fixtures/generate`, 4).expect(403);
    const matches = await prisma.match.findMany({ where: { tournamentId: id }, include: { fixture: true }, orderBy: { fixture: { sequence: 'asc' } } });
    expect(matches).toHaveLength(2);
    expect(matches[0].fixture.homeRegistrationId).toBe(matches[1].fixture.awayRegistrationId);
    await post(`matches/${matches[0].id}/results`, 4, { homeScore: -1, awayScore: 0 }).expect(400);
    await post(`matches/${matches[0].id}/results`, 4, { homeScore: 1, awayScore: 0, status: 'CONFIRMED' }).expect(400);
    await post(`matches/${matches[0].id}/results`, 1, { homeScore: 2, awayScore: 0 }).expect(403);
    const result = await post(`matches/${matches[0].id}/results`, 2, { homeScore: 2, awayScore: 0 }).expect(201);
    await post(`results/${result.body.data.submission.id}/confirm`, 2).expect(403);
    await post(`results/${result.body.data.submission.id}/confirm`, 4).expect(201);
    await expect(awards.completeTournament(users[0].id, id)).rejects.toMatchObject({ status: 409 });
    await record(matches[1].id, 1, 1);
    const table = (await get(`tournaments/${id}/standings`, 2).expect(200)).body.data;
    expect(table.tournament).toMatchObject({ competitionFormat: 'DOUBLE_ROUND_ROBIN', legType: 'HOME_AWAY' });
    const standings = table.standings;
    expect(standings.map((row: { played: number }) => row.played)).toEqual([2, 2]);
    expect(standings.map((row: { points: number }) => row.points).sort((a: number, b: number) => a - b)).toEqual([1, 4]);
    await get(`tournaments/${id}/standings`, 1).expect(403);
    const completed = await post(`tournaments/${id}/complete`, 4).expect(201);
    expect(completed.body.success).toBe(true);
    const champion = await prisma.achievement.findMany({ where: { tournamentId: id, type: 'TOURNAMENT_CHAMPION' } });
    expect(champion).toHaveLength(1);
    await corrections.correctResult(users[0].id, matches[0].id, { homeScore: 0, awayScore: 3, reason: 'Synthetic score correction' });
    expect(await prisma.achievement.count({ where: { tournamentId: id } })).toBe(0);
    expect((await prisma.tournament.findUniqueOrThrow({ where: { id } })).status).toBe('ACTIVE');
    await awards.completeTournament(users[0].id, id);
    const changed = await prisma.achievement.findFirstOrThrow({ where: { tournamentId: id, type: 'TOURNAMENT_CHAMPION' } });
    expect(changed.userId).not.toBe(champion[0].userId);
  }, 45_000);

  it('handles real concurrent fixture generation and duplicate result submission/confirmation without double counting', async () => {
    const id = await tournament('LEAGUE_ROUND_ROBIN');
    const generated = await Promise.allSettled([fixtures.generateFixtures(users[0].id, id), fixtures.generateFixtures(users[0].id, id)]);
    expect(generated.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(generated.find((row) => row.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    expect(await prisma.fixture.count({ where: { tournamentId: id } })).toBe(1);
    const match = await prisma.match.findFirstOrThrow({ where: { tournamentId: id } });
    const submitted = await Promise.allSettled([results.submitResult(users[2].id, match.id, { homeScore: 2, awayScore: 1 }), results.submitResult(users[3].id, match.id, { homeScore: 2, awayScore: 1 })]);
    expect(submitted.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(submitted.find((row) => row.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    const result = await prisma.resultSubmission.findFirstOrThrow({ where: { matchId: match.id } });
    const confirmed = await Promise.allSettled([results.confirmResult(users[0].id, result.id), results.confirmResult(users[0].id, result.id)]);
    expect(confirmed.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(confirmed.find((row) => row.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    expect(await prisma.matchResultStatEvent.count({ where: { matchId: match.id, type: 'APPLY' } })).toBe(1);
    expect((await prisma.tournamentStanding.findMany({ where: { tournamentId: id } })).map((row) => row.played)).toEqual([1, 1]);
    await corrections.reverseResult(users[0].id, match.id, { reason: 'Synthetic reversal' });
    expect(await prisma.tournamentStanding.count({ where: { tournamentId: id } })).toBe(0);
    await record(match.id, 1, 1);
    expect((await prisma.tournamentStanding.findMany({ where: { tournamentId: id } })).map((row) => row.points)).toEqual([1, 1]);
  }, 30_000);

  it('keeps confirmation/rejection races consistent and rolls back invalid knockout progression', async () => {
    const id = await tournament('SINGLE_ELIMINATION');
    await fixtures.generateFixtures(users[0].id, id);
    const match = await prisma.match.findFirstOrThrow({ where: { tournamentId: id } });
    const result = await results.submitResult(users[0].id, match.id, { homeScore: 2, awayScore: 0 });
    const reviewed = await Promise.allSettled([results.confirmResult(users[0].id, result.data.submission.id), results.rejectResult(users[0].id, result.data.submission.id, { reason: 'Synthetic review' })]);
    expect(reviewed.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const current = await prisma.match.findUniqueOrThrow({ where: { id: match.id }, include: { confirmedResult: true } });
    if (current.confirmedResult) expect(current.confirmedResult.status).toBe('CONFIRMED');
    else expect(await prisma.matchResultStatEvent.count({ where: { matchId: match.id } })).toBe(0);

    const knockout = await tournament('SINGLE_ELIMINATION', 3);
    await fixtures.generateFixtures(users[0].id, knockout);
    const opening = await prisma.fixture.findFirstOrThrow({ where: { tournamentId: knockout, nextFixtureId: { not: null } }, include: { match: true } });
    // Corrupt only a synthetic downstream slot to verify full rollback of
    // result, event, fixture and player-stat writes when progression fails.
    await prisma.fixture.update({ where: { id: opening.nextFixtureId! }, data: { [opening.nextSlot === 'HOME' ? 'homeRegistrationId' : 'awayRegistrationId']: opening.awayRegistrationId } });
    const pending = await results.submitResult(users[0].id, opening.match!.id, { homeScore: 3, awayScore: 0 });
    await expect(results.confirmResult(users[0].id, pending.data.submission.id)).rejects.toMatchObject({ status: 409 });
    expect((await prisma.resultSubmission.findUniqueOrThrow({ where: { id: pending.data.submission.id } })).status).toBe('PENDING_VERIFICATION');
    expect((await prisma.match.findUniqueOrThrow({ where: { id: opening.match!.id } })).confirmedResultSubmissionId).toBeNull();
    expect(await prisma.matchResultStatEvent.count({ where: { tournamentId: knockout } })).toBe(0);
    expect(await prisma.playerTournamentStatistic.count({ where: { tournamentId: knockout } })).toBe(0);
  }, 30_000);

  it('serializes manual/OCR submissions through the same authorization and duplicate checks', async () => {
    const id = await tournament('LEAGUE_ROUND_ROBIN');
    await fixtures.generateFixtures(users[0].id, id);
    const match = await prisma.match.findFirstOrThrow({ where: { tournamentId: id } });
    const extraction = await prisma.ocrExtraction.create({ data: {
      matchId: match.id, submittedByUserId: users[2].id, status: 'COMPLETED',
      imagePath: '/tmp/omnirush/synthetic-not-a-real-image.png', mimeType: 'image/png', fileSize: 1,
    } });
    const ocr = app.get(OcrService);
    await expect(ocr.submitOcrResult(users[1].id, extraction.id, { homeScore: 2, awayScore: 0 })).rejects.toMatchObject({ status: 403 });
    const submitted = await Promise.allSettled([
      ocr.submitOcrResult(users[2].id, extraction.id, { homeScore: 2, awayScore: 0 }),
      results.submitResult(users[3].id, match.id, { homeScore: 2, awayScore: 0 }),
    ]);
    expect(submitted.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(submitted.find((row) => row.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    expect(await prisma.resultSubmission.count({ where: { matchId: match.id, status: 'PENDING_VERIFICATION' } })).toBe(1);
    const pending = await prisma.resultSubmission.findFirstOrThrow({ where: { matchId: match.id } });
    await results.rejectResult(users[0].id, pending.id, { reason: 'Synthetic re-submit' });
    const extraction2 = await prisma.ocrExtraction.create({ data: {
      matchId: match.id, submittedByUserId: users[2].id, status: 'COMPLETED',
      imagePath: '/tmp/omnirush/synthetic-not-a-real-image.png', mimeType: 'image/png', fileSize: 1,
    } });
    const shared = await ocr.submitOcrResult(users[2].id, extraction2.id, { homeScore: 1, awayScore: 1 });
    expect(shared.data.submission.source).toBe('OCR');
    await results.confirmResult(users[0].id, shared.data.submission.id);
    expect((await prisma.tournamentStanding.findMany({ where: { tournamentId: id } })).map((row) => row.points)).toEqual([1, 1]);
  }, 30_000);

  it('requires a real final, prevents changing a started downstream match, and preserves knockout draw rules', async () => {
    const id = await tournament('SINGLE_ELIMINATION', 3);
    await fixtures.generateFixtures(users[0].id, id);
    const first = await prisma.fixture.findFirstOrThrow({ where: { tournamentId: id, nextFixtureId: { not: null } }, include: { match: true } });
    const draw = await results.submitResult(users[0].id, first.match!.id, { homeScore: 1, awayScore: 1 });
    await expect(results.confirmResult(users[0].id, draw.data.submission.id)).rejects.toMatchObject({ status: 400 });
    await results.rejectResult(users[0].id, draw.data.submission.id, { reason: 'Draw requires replay' });
    await record(first.match!.id);
    const final = await prisma.fixture.findUniqueOrThrow({ where: { id: first.nextFixtureId! }, include: { match: true } });
    expect(final.homeRegistrationId).not.toBeNull();
    expect(final.awayRegistrationId).not.toBeNull();
    await prisma.fixture.update({ where: { id: final.id }, data: { status: 'CANCELLED' } });
    await prisma.match.update({ where: { id: final.match!.id }, data: { status: 'CANCELLED' } });
    await expect(awards.completeTournament(users[0].id, id)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.achievement.count({ where: { tournamentId: id } })).toBe(0);
    await prisma.fixture.update({ where: { id: final.id }, data: { status: 'LIVE' } });
    await prisma.match.update({ where: { id: final.match!.id }, data: { status: 'LIVE' } });
    await expect(corrections.correctResult(users[0].id, first.match!.id, { homeScore: 0, awayScore: 2, reason: 'Too late' })).rejects.toMatchObject({ status: 409 });
    await record(final.match!.id);
    await awards.completeTournament(users[0].id, id);
  }, 30_000);

  it('cross-seeds group winners, excludes outsiders and separates SOLO/DUO league rankings', async () => {
    const id = await tournament('LEAGUE_ROUND_ROBIN');
    await prisma.tournament.update({ where: { id }, data: { competitionFormat: 'GROUP_STAGE_KNOCKOUT', groupMode: 'MULTIPLE_GROUPS' } });
    const entries = await prisma.tournamentRegistration.findMany({ where: { tournamentId: id }, orderBy: { createdAt: 'asc' } });
    for (const index of [0, 4]) entries.push(await prisma.tournamentRegistration.create({ data: {
      tournamentId: id, registeredByUserId: users[index].id, entryName: users[index].email, status: 'APPROVED',
      members: { create: { tournamentId: id, userId: users[index].id } },
    } }));
    const groups = await Promise.all(['A', 'B'].map((name, position) => prisma.tournamentGroup.create({ data: { tournamentId: id, name, position } })));
    for (let index = 0; index < entries.length; index++) await prisma.tournamentRegistration.update({ where: { id: entries[index].id }, data: { groupId: groups[index < 2 ? 0 : 1].id } });
    const groupMatches = [];
    for (let index = 0; index < 2; index++) {
      const fixture = await prisma.fixture.create({ data: {
        tournamentId: id, groupId: groups[index].id, fixtureCode: `Q-${randomUUID().slice(0, 16)}`, sequence: index + 1,
        roundNumber: 1, matchday: 1, bracketPosition: 1, roundName: 'MATCHDAY 1', homeRegistrationId: entries[index * 2].id,
        awayRegistrationId: entries[index * 2 + 1].id, match: { create: { tournamentId: id } },
      }, include: { match: true } });
      groupMatches.push(fixture.match!.id);
    }
    const playoffs = app.get(PlayoffsService);
    await expect(playoffs.generatePlayoffs(users[0].id, id, { qualifiersPerGroup: 1 })).rejects.toMatchObject({ status: 409 });
    await Promise.all(groupMatches.map((matchId) => record(matchId, 2, 0)));
    const generated = await playoffs.generatePlayoffs(users[0].id, id, { qualifiersPerGroup: 1 });
    expect(generated.data.totalQualifiers).toBe(2);
    const final = await prisma.fixture.findFirstOrThrow({ where: { tournamentId: id, groupId: null }, include: { match: true } });
    expect([final.homeRegistrationId, final.awayRegistrationId].sort((a, b) => (a ?? '').localeCompare(b ?? ''))).toEqual([entries[0].id, entries[2].id].sort((a, b) => a.localeCompare(b)));
    await expect(playoffs.generatePlayoffs(users[0].id, id, { qualifiersPerGroup: 1 })).rejects.toMatchObject({ status: 409 });
    await expect(playoffs.generatePlayoffs(users[1].id, id, { qualifiersPerGroup: 1 })).rejects.toMatchObject({ status: 403 });
    await record(final.match!.id, 2, 1);
    await awards.completeTournament(users[0].id, id);
    const duo = await tournaments.createTournament(users[0].id, league.id, { name: `Duo filter ${run}`, mode: 'DUO', competitionFormat: 'LEAGUE_ROUND_ROBIN', maxEntries: 8 });
    await prisma.playerTournamentStatistic.create({ data: { tournamentId: duo.data.tournament.id, userId: users[2].id, matches: 99, wins: 99, goalsFor: 999, goalsAgainst: 0, goalDifference: 999 } });
    const rankings = app.get(RankingsService);
    const solo = await rankings.getLeagueRankings(users[2].id, league.id, 'SOLO');
    const duoOnly = await rankings.getLeagueRankings(users[2].id, league.id, 'DUO');
    expect(solo.data.rankings.find((row) => row.userId === users[2].id)!.matches).toBeLessThan(99);
    expect(duoOnly.data.rankings.find((row) => row.userId === users[2].id)!.matches).toBe(99);
    await expect(rankings.getLeagueRankings(users[1].id, league.id, 'SOLO')).rejects.toMatchObject({ status: 403 });
  }, 30_000);

  it('retries actual PostgreSQL serialization conflicts and bounds concurrent incorrect OTP attempts', async () => {
    const keyHash = randomUUID().replaceAll('-', '').padEnd(64, '0');
    await prisma.authRateLimit.create({ data: { action: 'QUALITY_RETRY', keyHash, attemptCount: 0, windowStartedAt: new Date() } });
    let calls = 0;
    let release: () => void = () => {};
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const increment = () => prisma.$transactionWithRetry(async (tx) => {
      const call = ++calls;
      const current = await tx.authRateLimit.findUniqueOrThrow({ where: { action_keyHash: { action: 'QUALITY_RETRY', keyHash } } });
      if (call <= 2) { if (call === 2) release(); await barrier; }
      await tx.authRateLimit.update({ where: { action_keyHash: { action: 'QUALITY_RETRY', keyHash } }, data: { attemptCount: current.attemptCount + 1 } });
    }, { isolationLevel: 'Serializable' });
    await Promise.all([increment(), increment()]);
    expect(calls).toBeGreaterThan(2);
    expect((await prisma.authRateLimit.findUniqueOrThrow({ where: { action_keyHash: { action: 'QUALITY_RETRY', keyHash } } })).attemptCount).toBe(2);
    const otp = await prisma.authOtp.create({ data: { userId: users[3].id, purpose: 'PASSWORD_RESET', codeHash: await bcrypt.hash('123456', 4), expiresAt: new Date(Date.now() + 60_000) } });
    const attempts = await Promise.allSettled(Array.from({ length: 10 }, () => auth.resetPassword({ email: users[3].email, otp: '999999', newPassword: 'Never-Applied-42!', confirmPassword: 'Never-Applied-42!' })));
    expect(attempts.every((row) => row.status === 'rejected')).toBe(true);
    expect((await prisma.authOtp.findUniqueOrThrow({ where: { id: otp.id } })).attempts).toBe(5);
    await auth.login({ email: users[3].email, password });
  }, 30_000);

  it('persists Top-3 byes/play-ins and progresses every qualifier exactly once to a real final', async () => {
    const extra = await prisma.user.create({ data: {
      fullName: 'Synthetic qualifier', email: `qualifier-${run}@example.test`, status: 'ACTIVE', passwordHash: await bcrypt.hash(password, 4),
    } });
    await prisma.leagueMember.create({ data: { leagueId: league.id, userId: extra.id, type: 'PRIMARY' } });
    await prisma.leagueMember.create({ data: { leagueId: league.id, userId: users[1].id, type: 'SECONDARY' } });
    const created = await tournaments.createTournament(users[0].id, league.id, {
      name: `Top-3 ${run}`, mode: 'SOLO', competitionFormat: 'GROUP_STAGE_KNOCKOUT', maxEntries: 8,
    });
    const id = created.data.tournament.id;
    const groups = await Promise.all(['A', 'B'].map((name, position) => prisma.tournamentGroup.create({ data: { tournamentId: id, name, position } })));
    const participants = [users[0].id, users[2].id, users[3].id, users[1].id, users[4].id, extra.id];
    const rank = new Map<string, number>();
    const topSeeds: string[] = [];
    for (let index = 0; index < participants.length; index++) {
      const entry = await prisma.tournamentRegistration.create({ data: {
        tournamentId: id, groupId: groups[index < 3 ? 0 : 1].id, registeredByUserId: participants[index],
        entryName: `Rank ${index % 3 + 1}`, status: 'APPROVED',
        members: { create: { tournamentId: id, userId: participants[index] } },
      } });
      rank.set(entry.id, index % 3);
      if (index % 3 === 0) topSeeds.push(entry.id);
    }
    await prisma.tournament.update({ where: { id }, data: { status: 'REGISTRATION_CLOSED' } });
    const { GroupFixturesService } = await import('../src/tournaments/group-fixtures.service.js');
    await expect(app.get(GroupFixturesService).generateGroupFixtures(users[1].id, id)).rejects.toMatchObject({ status: 403 });
    await post('security/roles', 0, { userId: users[4].id, role: 'MATCH_OFFICIAL', scopeType: 'TOURNAMENT', scopeId: id }).expect(201);
    await app.get(GroupFixturesService).generateGroupFixtures(users[4].id, id);
    const groupFixtures = await prisma.fixture.findMany({ where: { tournamentId: id }, include: { match: true }, orderBy: { sequence: 'asc' } });
    expect(groupFixtures).toHaveLength(6);
    for (const fixture of groupFixtures) await record(fixture.match!.id,
      rank.get(fixture.homeRegistrationId!)! < rank.get(fixture.awayRegistrationId!)! ? 3 : 0,
      rank.get(fixture.homeRegistrationId!)! < rank.get(fixture.awayRegistrationId!)! ? 0 : 3);
    const plan = await app.get(PlayoffsService).generatePlayoffs(users[0].id, id, { qualifiersPerGroup: 3 });
    expect(plan.data).toMatchObject({ totalQualifiers: 6, byes: 2, playInMatches: 2, bracketSize: 8, fixtures: 5 });
    const bracket = await prisma.fixture.findMany({ where: { tournamentId: id, groupId: null }, include: { match: true }, orderBy: [{ roundNumber: 'asc' }, { bracketPosition: 'asc' }] });
    expect(bracket.filter((fixture) => fixture.roundName === 'PLAY-IN')).toHaveLength(2);
    const initiallyAssigned = bracket.flatMap((fixture) => [fixture.homeRegistrationId, fixture.awayRegistrationId]).filter(Boolean);
    expect(new Set(initiallyAssigned).size).toBe(6);
    for (const seed of topSeeds) expect(bracket.some((fixture) => fixture.roundNumber === 2 && (fixture.homeRegistrationId === seed || fixture.awayRegistrationId === seed))).toBe(true);
    await expect(awards.completeTournament(users[0].id, id)).rejects.toMatchObject({ status: 409 });
    for (const fixture of bracket) await record(fixture.match!.id, 2, 0);
    await awards.completeTournament(users[0].id, id);
    expect(await prisma.achievement.count({ where: { tournamentId: id, type: 'TOURNAMENT_CHAMPION' } })).toBe(1);
  }, 45_000);

  it('consumes password-reset OTPs once under concurrency, enforces status, rotates refresh once and revokes access on logout/reset', async () => {
    const login = await auth.login({ email: users[4].email, password });
    const rotated = await Promise.allSettled([auth.refresh(login.data.refreshToken), auth.refresh(login.data.refreshToken)]);
    expect(rotated.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(rotated.find((row) => row.status === 'rejected')).toMatchObject({ reason: { status: 401 } });
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${login.data.accessToken}`).expect(401);
    const fresh = rotated.find((row) => row.status === 'fulfilled');
    if (fresh?.status !== 'fulfilled') throw new Error('Refresh did not succeed');
    await auth.logout(fresh.value.data.refreshToken);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${fresh.value.data.accessToken}`).expect(401);
    const beforeReset = await auth.login({ email: users[4].email, password });
    const otp = await prisma.authOtp.create({ data: { userId: users[4].id, purpose: 'PASSWORD_RESET', codeHash: await bcrypt.hash('123456', 4), expiresAt: new Date(Date.now() + 60_000) } });
    const resets = await Promise.allSettled([auth.resetPassword({ email: users[4].email, otp: '123456', newPassword: 'New-Quality-42!', confirmPassword: 'New-Quality-42!' }), auth.resetPassword({ email: users[4].email, otp: '123456', newPassword: 'Other-Quality-42!', confirmPassword: 'Other-Quality-42!' })]);
    expect(resets.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(resets.find((row) => row.status === 'rejected')).toMatchObject({ reason: { status: 400 } });
    expect((await prisma.authOtp.findUniqueOrThrow({ where: { id: otp.id } })).consumedAt).not.toBeNull();
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${beforeReset.data.accessToken}`).expect(401);
    await prisma.user.update({ where: { id: users[4].id }, data: { status: 'SUSPENDED' } });
    await prisma.authOtp.create({ data: { userId: users[4].id, purpose: 'EMAIL_VERIFICATION', codeHash: await bcrypt.hash('123456', 4), expiresAt: new Date(Date.now() + 60_000) } });
    await expect(auth.verifyEmail({ email: users[4].email, otp: '123456' })).rejects.toMatchObject({ status: 400 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: users[4].id } })).status).toBe('SUSPENDED');
    await expect(auth.refresh(beforeReset.data.refreshToken)).rejects.toMatchObject({ status: 401 });
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${users[4].token}`).expect(401);
  }, 30_000);

  it('blocks incomplete/missing return legs and locks completed wars while preserving configured points and draw tiebreaks', async () => {
    const war = await prisma.leagueWar.create({ data: {
      name: `Quality war ${run}`, homeLeagueId: league.id, awayLeagueId: otherLeague.id,
      createdByUserId: users[0].id, status: 'LIVE', playerCount: 1, legType: 'HOME_AWAY',
      winPoints: 5, drawPoints: 2, lossPoints: 0,
      participants: { create: [{ leagueId: league.id, userId: users[2].id, slot: 1 }, { leagueId: otherLeague.id, userId: users[1].id, slot: 1 }] },
      matches: { create: { sequence: 1, leg: 1, homePlayerUserId: users[2].id, awayPlayerUserId: users[1].id, homeScore: 4, awayScore: 0, status: 'COMPLETED', resultStatus: 'CONFIRMED' } },
    } });
    await expect(wars.completeWar(users[0].id, war.id)).rejects.toMatchObject({ status: 409 });
    const leg2 = await prisma.leagueWarMatch.create({ data: { warId: war.id, sequence: 2, leg: 2, homePlayerUserId: users[1].id, awayPlayerUserId: users[2].id } });
    await expect(wars.completeWar(users[0].id, war.id)).rejects.toMatchObject({ status: 409 });
    await wars.submitResult(users[0].id, war.id, leg2.id, { homeScore: 1, awayScore: 1 });
    await expect(wars.confirmResult(users[0].id, war.id, leg2.id)).rejects.toMatchObject({ status: 403 });
    await wars.confirmResult(users[1].id, war.id, leg2.id);
    await wars.completeWar(users[0].id, war.id);
    const completed = await wars.getWar(users[0].id, war.id);
    expect(completed.data.war.winnerLeagueId).toBe(league.id);
    expect(completed.data.war.summary.home.points).toBe(7);
    expect(completed.data.war.summary.away.points).toBe(2);
    expect(completed.data.war.summary.home.goalsFor).toBe(5);
    await expect(wars.submitResult(users[0].id, war.id, leg2.id, { homeScore: 9, awayScore: 0 })).rejects.toMatchObject({ status: 403 });
    const tied = (wars as unknown as { summary: (war: object, matches: object[]) => { leaderLeagueId: string | null } }).summary(
      { homeLeagueId: league.id, awayLeagueId: otherLeague.id, winPoints: 5, drawPoints: 2, lossPoints: 0, legType: 'HOME_AWAY', playerCount: 1 },
      [{ leg: 1, status: 'COMPLETED', homeScore: 3, awayScore: 1 }, { leg: 2, status: 'COMPLETED', homeScore: 3, awayScore: 1 }],
    );
    expect(tied.leaderLeagueId).toBeNull();
  }, 30_000);

  it('applies real CORS/security headers, rejects DTO privilege injection and enforces registration rate limits', async () => {
    const health = await request(app.getHttpServer()).get('/api/health').set('Origin', 'https://fcarena.in').expect(200);
    expect(health.headers['access-control-allow-origin']).toBe('https://fcarena.in');
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['cache-control']).toBe('no-store');
    expect(health.headers['x-powered-by']).toBeUndefined();
    const denied = await request(app.getHttpServer()).post('/api/auth/register').set('Origin', 'https://untrusted.example').send({}).expect(403);
    expect(denied.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    await request(app.getHttpServer()).post('/api/auth/register').send({ email: 'invalid@example.test', fullName: 'Invalid', password, confirmPassword: password, inGameName: 'Invalid', role: 'SUPER_ADMIN' }).expect(400);
    await request(app.getHttpServer()).post('/api/auth/register').send({ email: `sixth-${run}@example.test`, fullName: 'Sixth', password, confirmPassword: password, inGameName: `Sixth${run}` }).expect(429);
    await request(app.getHttpServer()).post('/api/players/me/profile-image').set('Authorization', `Bearer ${users[2].token}`)
      .attach('image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
    await request(app.getHttpServer()).post('/api/players/me/profile-image').set('Authorization', `Bearer ${users[2].token}`)
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' }).expect(413);
  });
});
