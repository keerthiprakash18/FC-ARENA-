import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthorizationService } from '../src/security/authorization.service.js';
import { TournamentsService } from '../src/tournaments/tournaments.service.js';
import { TournamentEntriesService } from '../src/tournaments/tournament-entries.service.js';
import { FixturesService } from '../src/tournaments/fixtures.service.js';
import { PlayoffsService } from '../src/tournaments/playoffs.service.js';
import { ResultsService } from '../src/results/results.service.js';
import { ResultCorrectionService } from '../src/results/result-correction.service.js';
import { PlayerDashboardService } from '../src/player-career/player-dashboard.service.js';
import { AchievementsService } from '../src/achievements/achievements.service.js';

describe('UCL season with real PostgreSQL and authorization', () => {
  let prisma: PrismaService;
  let tournaments: TournamentsService;
  let entries: TournamentEntriesService;
  let fixtures: FixturesService;
  let playoffs: PlayoffsService;
  let results: ResultsService;
  let corrections: ResultCorrectionService;
  let achievements: AchievementsService;
  let leagueId: string;
  let tournamentId: string;
  const run = randomUUID().slice(0, 8);
  const users = Array.from({ length: 36 }, (_, index) => ({ id: randomUUID(), code: `UCL-${run}-${index}`.toUpperCase() }));
  const owner = users[0].id;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
      throw new Error('UCL E2E requires an explicitly selected disposable loopback *_test database.');
    }
    prisma = new PrismaService();
    await prisma.$connect();
    const authorization = new AuthorizationService(prisma);
    const realtime = { publish: () => undefined } as never;
    tournaments = new TournamentsService(prisma, authorization);
    entries = new TournamentEntriesService(prisma, authorization);
    fixtures = new FixturesService(prisma, authorization, realtime);
    playoffs = new PlayoffsService(prisma, authorization);
    results = new ResultsService(prisma, authorization, realtime);
    corrections = new ResultCorrectionService(prisma, authorization, realtime);
    achievements = new AchievementsService(prisma, authorization);
    await prisma.user.createMany({ data: users.map((user, index) => ({ id: user.id, email: `ucl-${run}-${index}@example.invalid`, fullName: `UCL Test ${index}`, passwordHash: 'not-a-login-hash', status: 'ACTIVE' })) });
    await prisma.player.createMany({ data: users.map(user => ({ userId: user.id, playerCode: user.code })) });
    const league = await prisma.league.create({ data: { name: `UCL Test ${run}`, code: `UCL${run}`, creatorUserId: owner } });
    leagueId = league.id;
    await prisma.leagueMember.createMany({ data: users.map(user => ({ leagueId, userId: user.id, type: 'PRIMARY' })) });
    await prisma.leagueAdmin.create({ data: { leagueId, userId: owner, role: 'OWNER' } });
    const created = await tournaments.createTournament(owner, leagueId, { name: `UCL 36 ${run}`, mode: 'SOLO', competitionFormat: 'UCL_CUP', maxEntries: 36 });
    tournamentId = created.data.tournament.id;
    for (const [index, user] of users.entries()) await prisma.tournamentRegistration.create({ data: {
      tournamentId, registeredByUserId: user.id, entryName: `Team ${index + 1}`, status: 'APPROVED', sortOrder: index,
      members: { create: { tournamentId, userId: user.id } },
    } });
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'REGISTRATION_CLOSED' } });
  }, 60_000);

  afterAll(async () => { await prisma?.$disconnect(); });

  it('generates all personal fixtures, allows display edits, and enforces roster and ownership limits', async () => {
    await fixtures.generateFixtures(owner, tournamentId);
    expect(await prisma.fixture.count({ where: { tournamentId, phase: 'STAGE' } })).toBe(144);
    const registration = await prisma.tournamentRegistration.findFirstOrThrow({ where: { tournamentId, registeredByUserId: users[1].id } });
    await expect(entries.updateEntry(users[1].id, tournamentId, registration.id, { entryName: 'Corrected team', entryLogoUrl: 'https://example.test/crest.png' })).resolves.toMatchObject({ success: true });
    await expect(entries.updateEntry(users[2].id, tournamentId, registration.id, { entryName: 'Not mine' })).rejects.toMatchObject({ status: 403 });
    await expect(entries.updateEntry(users[1].id, tournamentId, registration.id, { playerCodes: [users[1].code] })).rejects.toMatchObject({ response: { error: { code: 'TOURNAMENT_TEAMS_HAVE_FIXTURES' } } });
    const mine = await tournaments.getMyRegistration(users[1].id, tournamentId);
    expect(mine.data).toMatchObject({ canEdit: true, canEditRoster: false });
    const dashboard = new PlayerDashboardService(prisma,
      { getMyLeagues: async () => ({ data: { leagues: [{ league: { id: leagueId } }] } }) } as never,
      { getMyCareer: async () => ({ data: { profile: {}, lifetimeStatistics: {}, tournamentHistory: [], matchHistory: [] } }) } as never);
    const summary = await dashboard.getSummary(users[1].id);
    expect(summary.data.fixtures).toHaveLength(8);
    expect(summary.data.fixtures.every(fixture => [...fixture.home?.members ?? [], ...fixture.away?.members ?? []].some(member => member.id === users[1].id))).toBe(true);
    expect(summary.data.fixtures.some(fixture => fixture.home?.entryLogoUrl === 'https://example.test/crest.png' || fixture.away?.entryLogoUrl === 'https://example.test/crest.png')).toBe(true);
  }, 30_000);

  it('links a manually created solo entry to its actual player before generating fixtures', async () => {
    const cup = await tournaments.createTournament(owner, leagueId, { name: `Manual entry ${run}`, mode: 'SOLO', competitionFormat: 'LEAGUE_ROUND_ROBIN', maxEntries: 2 });
    const entry = await entries.createEntry(owner, cup.data.tournament.id, { entryName: 'Manual player' });
    await entries.updateEntry(owner, cup.data.tournament.id, entry.data.entry.id, { playerCodes: [users[2].code] });
    expect(await prisma.tournamentRegistrationMember.count({ where: { registrationId: entry.data.entry.id, userId: users[2].id } })).toBe(1);
  });

  it('plays two-legged seeded knockouts and a penalty final without changing the league table', async () => {
    const stage = await prisma.fixture.findMany({ where: { tournamentId, phase: 'STAGE' }, include: { match: true } });
    // Seed a completed drawn league phase without involving any email, queue or live server.
    for (const fixture of stage) {
      const result = await prisma.resultSubmission.create({ data: { matchId: fixture.match!.id, submittedByUserId: owner, reviewedByUserId: owner, homeScore: 0, awayScore: 0, status: 'CONFIRMED' } });
      await prisma.match.update({ where: { id: fixture.match!.id }, data: { confirmedResultSubmissionId: result.id, status: 'COMPLETED' } });
      await prisma.fixture.update({ where: { id: fixture.id }, data: { status: 'COMPLETED' } });
    }
    const before = await results.getStandings(owner, tournamentId);
    expect(before.data.standings.every(row => row.played === 8 && row.points === 8)).toBe(true);
    await expect(achievements.completeTournament(owner, tournamentId)).rejects.toMatchObject({ response: { error: { code: 'PLAYOFF_STAGE_REQUIRED' } } });
    await playoffs.generatePlayoffs(owner, tournamentId, { qualifiersPerGroup: 1 });
    expect(await prisma.fixture.count({ where: { tournamentId, phase: 'PLAYOFF' } })).toBe(45);
    const knockout = await prisma.fixture.findMany({ where: { tournamentId, phase: 'PLAYOFF' }, orderBy: { sequence: 'asc' }, include: { match: true } });
    let firstConfirmed: string | null = null;
    for (const fixture of knockout) {
      const current = await prisma.fixture.findUniqueOrThrow({ where: { id: fixture.id } });
      expect(current.homeRegistrationId).toBeTruthy();
      expect(current.awayRegistrationId).toBeTruthy();
      const score = fixture.matchday === 1 ? { homeScore: 0, awayScore: 0 }
        : fixture.matchday === 2 ? { homeScore: 1, awayScore: 0 }
          : { homeScore: 1, awayScore: 1, homePenaltyScore: 5, awayPenaltyScore: 4 };
      const submitted = await results.submitResult(owner, fixture.match!.id, score);
      await results.confirmResult(owner, submitted.data.submission.id);
      if (fixture.matchday === 1 && !firstConfirmed) firstConfirmed = fixture.match!.id;
    }
    expect(await prisma.fixture.count({ where: { tournamentId, status: 'COMPLETED' } })).toBe(189);
    const after = await results.getStandings(owner, tournamentId);
    expect(after.data.standings.map(row => [row.registrationId, row.played, row.points])).toEqual(before.data.standings.map(row => [row.registrationId, row.played, row.points]));
    await expect(corrections.correctResult(owner, firstConfirmed!, { homeScore: 3, awayScore: 0, reason: 'Downstream guard test' })).rejects.toMatchObject({ response: { error: { code: 'UCL_RETURN_LEG_STARTED' } } });
    const final = knockout.at(-1)!;
    const confirmed = await prisma.match.findUniqueOrThrow({ where: { id: final.match!.id }, include: { confirmedResult: true } });
    expect(confirmed.confirmedResult).toMatchObject({ homeScore: 1, awayScore: 1, homePenaltyScore: 5, awayPenaltyScore: 4 });
    await expect(prisma.resultSubmission.create({ data: { matchId: final.match!.id, submittedByUserId: owner, homeScore: 0, awayScore: 0, homePenaltyScore: 4, awayPenaltyScore: null } })).rejects.toThrow();
    await achievements.completeTournament(owner, tournamentId);
    expect(await prisma.tournament.findUnique({ where: { id: tournamentId } })).toMatchObject({ status: 'COMPLETED' });
    expect(await prisma.achievement.count({ where: { tournamentId, userId: users[0].id, type: 'TOURNAMENT_CHAMPION' } })).toBe(1);
    const summary = await prisma.tournamentSummary.findUniqueOrThrow({ where: { tournamentId } });
    expect((summary.snapshot as any).placements.champion.registrationId).toBe(final.homeRegistrationId ?? (await prisma.fixture.findUniqueOrThrow({ where: { id: final.id } })).homeRegistrationId);
  }, 180_000);
});
