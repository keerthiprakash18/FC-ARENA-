import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthorizationService } from '../src/security/authorization.service.js';
import { TournamentPlayerReplacementService } from '../src/tournaments/tournament-player-replacement.service.js';
import { ResultsService } from '../src/results/results.service.js';
import { ResultCorrectionService } from '../src/results/result-correction.service.js';
import { PlayerCareerService } from '../src/player-career/player-career.service.js';
import type { MatchRealtimeService } from '../src/matches/match-realtime.service.js';

describe('Player replacement keeps generated groups, fixtures and results in real PostgreSQL', () => {
  const run = randomUUID().slice(0, 8);
  const ids = Array.from({ length: 8 }, () => randomUUID());
  let db: PrismaService, replace: TournamentPlayerReplacementService, results: ResultsService, corrections: ResultCorrectionService;
  let cup: string, league: string, entry: string, opponent: string, group: string, pastMatch: string, nextMatch: string, pastResult: string;
  const code = (i: number) => `RE-${run}-${i}`.toUpperCase();
  const request = (i = 3, outgoingUserId = ids[1]) => ({ outgoingUserId, replacementPlayerCode: code(i), reason: 'Player did not attend' });
  async function protectedState() {
    return {
      fixtures: await db.fixture.findMany({ where: { tournamentId: cup }, orderBy: { id: 'asc' } }),
      matches: await db.match.findMany({ where: { tournamentId: cup }, orderBy: { id: 'asc' } }),
      results: await db.resultSubmission.findMany({ where: { match: { tournamentId: cup } }, orderBy: { id: 'asc' } }),
      groups: await db.tournamentGroup.findMany({ where: { tournamentId: cup }, orderBy: { id: 'asc' } }),
      standings: await db.tournamentStanding.findMany({ where: { tournamentId: cup }, orderBy: { id: 'asc' } }),
      statistics: await db.playerTournamentStatistic.findMany({ where: { tournamentId: cup }, orderBy: { id: 'asc' } }),
    };
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw Error('Disposable loopback *_test database required');
    db = new PrismaService(); await db.$connect();
    const auth = new AuthorizationService(db);
    const realtime = { publish() {} } as unknown as MatchRealtimeService;
    replace = new TournamentPlayerReplacementService(db, auth);
    results = new ResultsService(db, auth, realtime);
    corrections = new ResultCorrectionService(db, auth, realtime);
    for (const [i, id] of ids.entries()) await db.user.create({ data: {
      id, email: `replace-${run}-${i}@example.invalid`, fullName: `Player ${i}`, passwordHash: 'not-a-login-hash', status: i === 6 ? 'SUSPENDED' : 'ACTIVE',
      player: { create: { playerCode: code(i), identity: { create: { inGameName: `Player ${run} ${i}`, inGameNameNormalized: `player ${run} ${i}`, isVerified: true } } } },
    } });
    league = (await db.league.create({ data: { name: 'Replacement test', code: `RE${run}`, creatorUserId: ids[0] } })).id;
    await db.leagueAdmin.create({ data: { leagueId: league, userId: ids[0], role: 'OWNER' } });
    await db.leagueMember.createMany({ data: ids.filter((_, i) => i !== 5).map(userId => ({ leagueId: league, userId, type: 'PRIMARY' })) });
    cup = (await db.tournament.create({ data: { name: 'Generated cup', code: `RE-T-${run}`, leagueId: league, createdByUserId: ids[0], mode: 'SOLO', format: 'ROUND_ROBIN', competitionFormat: 'DOUBLE_ROUND_ROBIN', legType: 'HOME_AWAY', groupMode: 'MULTIPLE_GROUPS', teamSize: 1, maxEntries: 42, status: 'ACTIVE' } })).id;
    group = (await db.tournamentGroup.create({ data: { tournamentId: cup, name: 'Group A', position: 0 } })).id;
    const createEntry = async (i: number, name: string) => (await db.tournamentRegistration.create({ data: { tournamentId: cup, groupId: group, entryName: name, entryLogoUrl: 'https://example.invalid/crest.png', sortOrder: i, status: 'APPROVED', registeredByUserId: ids[i], members: { create: { tournamentId: cup, userId: ids[i] } } } })).id;
    entry = await createEntry(1, 'Home team'); opponent = await createEntry(2, 'Away team'); await createEntry(4, 'Other team');
    const first = await db.fixture.create({ data: { tournamentId: cup, groupId: group, fixtureCode: `RE-F1-${run}`, roundName: 'Round 1', sequence: 1, roundNumber: 1, bracketPosition: 1, matchday: 1, homeRegistrationId: entry, awayRegistrationId: opponent, status: 'COMPLETED', match: { create: { tournamentId: cup, matchCode: `RE-M1-${run}`, status: 'COMPLETED' } } }, include: { match: true } });
    const second = await db.fixture.create({ data: { tournamentId: cup, groupId: group, fixtureCode: `RE-F2-${run}`, roundName: 'Round 4', sequence: 2, roundNumber: 4, bracketPosition: 1, matchday: 4, homeRegistrationId: opponent, awayRegistrationId: entry, status: 'SCHEDULED', match: { create: { tournamentId: cup, matchCode: `RE-M2-${run}`, status: 'SCHEDULED' } } }, include: { match: true } });
    pastMatch = first.match!.id; nextMatch = second.match!.id;
    pastResult = (await db.resultSubmission.create({ data: { matchId: pastMatch, submittedByUserId: ids[1], homeScore: 3, awayScore: 1, status: 'CONFIRMED', reviewedByUserId: ids[0], reviewedAt: new Date() } })).id;
    await db.match.update({ where: { id: pastMatch }, data: { confirmedResultSubmissionId: pastResult } });
    await db.tournamentStanding.createMany({ data: [{ tournamentId: cup, registrationId: entry, played: 1, wins: 1, goalsFor: 3, goalsAgainst: 1, goalDifference: 2, points: 3, form: 'W' }, { tournamentId: cup, registrationId: opponent, played: 1, losses: 1, goalsFor: 1, goalsAgainst: 3, goalDifference: -2, form: 'L' }] });
    await db.playerTournamentStatistic.createMany({ data: [{ tournamentId: cup, userId: ids[1], matches: 1, wins: 1, goalsFor: 3, goalsAgainst: 1, goalDifference: 2, form: 'W' }, { tournamentId: cup, userId: ids[2], matches: 1, losses: 1, goalsFor: 1, goalsAgainst: 3, goalDifference: -2, form: 'L' }] });
  }, 60000);
  afterAll(async () => { await db?.$disconnect(); });

  it('previews the exact outgoing and incoming player without mutating any competition data', async () => {
    const before = await protectedState();
    expect((await replace.preview(ids[0], cup, entry, request())).data).toMatchObject({
      entry: { id: entry, name: 'Home team', groupName: 'Group A' }, outgoing: { id: ids[1] }, replacement: { id: ids[3], playerCode: code(3) }, fixtureCount: 2, confirmedMatchCount: 1,
    });
    expect(await protectedState()).toEqual(before);
    expect(await db.auditLog.count({ where: { action: 'TOURNAMENT_PLAYER_REPLACED', scopeId: cup } })).toBe(0);
  });
  it('denies players/captains without management permission and validates league membership, account status and duplicate entries', async () => {
    for (const actor of [ids[1], ids[3], ids[5]]) await expect(replace.replace(actor, cup, entry, request())).rejects.toMatchObject({ status: 403 });
    for (const i of [1, 2, 4, 5, 6]) await expect(replace.replace(ids[0], cup, entry, request(i))).rejects.toThrow();
    await expect(replace.replace(ids[0], cup, opponent, request())).rejects.toThrow('no longer in the entry');
    await expect(replace.replace(ids[0], cup, entry, { ...request(), replacementPlayerCode: 'MISSING' })).rejects.toThrow('could not be found');
    expect(await db.tournamentRegistrationMember.findUnique({ where: { tournamentId_userId: { tournamentId: cup, userId: ids[1] } } })).not.toBeNull();
  });
  it('swaps only the membership, preserves every group, fixture, match, score, standing and statistic, and audits the change', async () => {
    const before = await protectedState();
    const member = await db.tournamentRegistrationMember.findUniqueOrThrow({ where: { tournamentId_userId: { tournamentId: cup, userId: ids[1] } } });
    await replace.replace(ids[0], cup, entry, request());
    expect(await protectedState()).toEqual(before);
    expect(await db.tournamentRegistrationMember.findUnique({ where: { id: member.id } })).toMatchObject({ registrationId: entry, userId: ids[3] });
    expect(await db.tournamentRegistration.findUnique({ where: { id: entry } })).toMatchObject({ groupId: group, entryName: 'Home team', status: 'APPROVED', sortOrder: 1, registeredByUserId: ids[3] });
    expect(await db.auditLog.findFirst({ where: { action: 'TOURNAMENT_PLAYER_REPLACED', targetId: entry } })).toMatchObject({ actorUserId: ids[0], beforeData: { userId: ids[1] }, afterData: { userId: ids[3] } });
    expect(await db.matchResultStatEvent.findUnique({ where: { resultSubmissionId_type: { resultSubmissionId: pastResult, type: 'APPLY' } } })).toMatchObject({ payload: { home: { userIds: [ids[1]] }, away: { userIds: [ids[2]] } } });
    await expect(replace.replace(ids[0], cup, entry, request())).rejects.toThrow('no longer in the entry');
  });
  it('allows the replacement to submit the next fixture and keeps old-player statistics when a new result rebuilds the table', async () => {
    await expect(results.submitResult(ids[1], nextMatch, { homeScore: 0, awayScore: 2 })).rejects.toThrow();
    const submission = await results.submitResult(ids[3], nextMatch, { homeScore: 0, awayScore: 2 });
    await results.confirmResult(ids[0], submission.data.submission.id);
    expect(await db.tournamentStanding.findUnique({ where: { registrationId: entry } })).toMatchObject({ played: 2, points: 6 });
    for (const i of [1, 3]) expect(await db.playerTournamentStatistic.findUnique({ where: { tournamentId_userId: { tournamentId: cup, userId: ids[i] } } })).toMatchObject({ matches: 1, wins: 1 });
    for (const i of [1, 3]) expect((await results.getMyStatistics(ids[i], cup)).data.statistic).toMatchObject({ matches: 1, wins: 1 });
    const career = new PlayerCareerService(db);
    expect((await career.getMyCareer(ids[1])).data.matchHistory.map(match => match.id)).toEqual([pastMatch]);
    expect((await career.getMyCareer(ids[3])).data.matchHistory.map(match => match.id)).toEqual([nextMatch]);
  });
  it('corrects and reverses an earlier result without crediting it to the replacement', async () => {
    await corrections.correctResult(ids[0], pastMatch, { homeScore: 2, awayScore: 2, reason: 'Correct old score after replacement' });
    expect(await db.playerTournamentStatistic.findUnique({ where: { tournamentId_userId: { tournamentId: cup, userId: ids[1] } } })).toMatchObject({ matches: 1, draws: 1, wins: 0 });
    expect(await db.playerTournamentStatistic.findUnique({ where: { tournamentId_userId: { tournamentId: cup, userId: ids[3] } } })).toMatchObject({ matches: 1, wins: 1, draws: 0 });
    await corrections.reverseResult(ids[0], pastMatch, { reason: 'Reverse old score after replacement' });
    expect(await db.playerTournamentStatistic.findUnique({ where: { tournamentId_userId: { tournamentId: cup, userId: ids[1] } } })).toBeNull();
    expect(await db.playerTournamentStatistic.findUnique({ where: { tournamentId_userId: { tournamentId: cup, userId: ids[3] } } })).toMatchObject({ matches: 1 });
  });
  it('commits exactly one concurrent replacement of the same departing player', async () => {
    const attempts = await Promise.allSettled([replace.replace(ids[0], cup, entry, request(7, ids[3])), replace.replace(ids[0], cup, entry, request(1, ids[3]))]);
    expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(await db.tournamentRegistrationMember.count({ where: { registrationId: entry } })).toBe(1);
    expect(await db.tournamentRegistration.count({ where: { tournamentId: cup } })).toBe(3);
  });
  it('locks replacement when the tournament is finished or cancelled', async () => {
    for (const status of ['COMPLETED', 'CANCELLED'] as const) {
      await db.tournament.update({ where: { id: cup }, data: { status } });
      await expect(replace.replace(ids[0], cup, entry, request())).rejects.toThrow('completed or cancelled');
    }
  });
  it('uses the actual replacement for the fourth DUO game in PostgreSQL without relabelling saved scores', async () => {
    const duo = (await db.tournament.create({ data: {
      name: 'DUO partial replacement', code: `RE-D-${run}`, leagueId: league, createdByUserId: ids[0],
      mode: 'DUO', format: 'ROUND_ROBIN', competitionFormat: 'DOUBLE_ROUND_ROBIN', legType: 'HOME_AWAY',
      groupMode: 'MULTIPLE_GROUPS', teamSize: 2, maxEntries: 4, status: 'ACTIVE',
      duoAggregateEnabled: true, duoGamesPerFixture: 4,
    } })).id;
    const duoGroup = (await db.tournamentGroup.create({ data: { tournamentId: duo, name: 'DUO Group A', position: 0 } })).id;
    const makeEntry = async (name: string, members: string[], sortOrder: number) => (await db.tournamentRegistration.create({ data: {
      tournamentId: duo, groupId: duoGroup, entryName: name, sortOrder, status: 'APPROVED',
      registeredByUserId: members[0]!, members: { create: members.map(userId => ({ tournamentId: duo, userId })) },
    } })).id;
    const homeEntry = await makeEntry('DUO Home', [ids[1]!, ids[4]!], 1);
    const awayEntry = await makeEntry('DUO Away', [ids[2]!, ids[7]!], 2);
    const fixture = await db.fixture.create({ data: {
      tournamentId: duo, groupId: duoGroup, fixtureCode: `RE-DF-${run}`, roundName: 'Round 1',
      sequence: 1, roundNumber: 1, bracketPosition: 1, matchday: 1, homeRegistrationId: homeEntry,
      awayRegistrationId: awayEntry, status: 'SCHEDULED',
      match: { create: { tournamentId: duo, matchCode: `RE-DM-${run}`, status: 'SCHEDULED' } },
    }, include: { match: true } });
    const matchId = fixture.match!.id;
    const makeGame = (homePlayerId: string, awayPlayerId: string, homeGoals: number, awayGoals: number) => ({
      homePlayerId, awayPlayerId, homeGoals, awayGoals, expectedVersion: 0,
    });
    // Departing player already played once. Their remaining game must belong to the new player.
    await results.saveDuoGame(ids[0]!, matchId, makeGame(ids[1]!, ids[2]!, 2, 1));
    await results.saveDuoGame(ids[0]!, matchId, makeGame(ids[4]!, ids[2]!, 1, 0));
    const third = await results.saveDuoGame(ids[0]!, matchId, makeGame(ids[4]!, ids[7]!, 4, 2));
    const originalGames = third.data.progress.games;
    const before = await db.match.findUniqueOrThrow({ where: { id: matchId } });
    await replace.replace(ids[0]!, duo, homeEntry, request(3, ids[1]));
    expect((await db.match.findUniqueOrThrow({ where: { id: matchId } })).duoGameProgress).toEqual(before.duoGameProgress);

    const view = (await results.getMatchResults(ids[3]!, matchId)).data.duoContext!;
    expect(view.home?.members.map(member => member.id)).toEqual(expect.arrayContaining([ids[3], ids[4]]));
    expect(view.home?.members.map(member => member.id)).not.toContain(ids[1]);
    expect(view.pairings.map(pair => [pair.player!.id, pair.opponent!.id])).toEqual(expect.arrayContaining([
      [ids[1], ids[2]], [ids[3], ids[7]],
    ]));
    expect(view.pairings.map(pair => [pair.player!.id, pair.opponent!.id])).not.toContainEqual([ids[1], ids[7]]);
    await expect(results.saveDuoGame(ids[1]!, matchId, makeGame(ids[1]!, ids[7]!, 0, 2))).rejects.toMatchObject({ status: 403 });
    await expect(results.saveDuoGame(ids[0]!, matchId, makeGame(ids[1]!, ids[7]!, 0, 2))).rejects.toThrow();
    const fourth = await results.saveDuoGame(ids[3]!, matchId, makeGame(ids[3]!, ids[7]!, 0, 2));
    expect(fourth.data.progress.games.slice(0,3)).toEqual(originalGames);
    expect(fourth.data.progress).toMatchObject({ completedGames: 4, homeScore: 7, awayScore: 5, complete: true });
    const submission = await results.submitResult(ids[3]!, matchId, {
      homeScore: 7, awayScore: 5,
      duoGames: fourth.data.progress.games.map(({ homePlayerId, awayPlayerId, homeGoals, awayGoals }) => ({ homePlayerId, awayPlayerId, homeGoals, awayGoals })),
    });
    await results.confirmResult(ids[0]!, submission.data.submission.id);
    expect(await db.match.findUniqueOrThrow({ where: { id: matchId } })).toMatchObject({ status: 'COMPLETED' });
    expect(await db.playerTournamentStatistic.findUnique({ where: { tournamentId_userId: { tournamentId: duo, userId: ids[1]! } } })).toMatchObject({ matches: 1, goalsFor: 2, goalsAgainst: 1 });
    expect(await db.playerTournamentStatistic.findUnique({ where: { tournamentId_userId: { tournamentId: duo, userId: ids[3]! } } })).toMatchObject({ matches: 1, goalsFor: 0, goalsAgainst: 2 });
    expect(await db.playerTournamentStatistic.findUnique({ where: { tournamentId_userId: { tournamentId: duo, userId: ids[4]! } } })).toMatchObject({ matches: 1, goalsFor: 5, goalsAgainst: 2 });
    expect(await db.tournamentStanding.findUnique({ where: { registrationId: homeEntry } })).toMatchObject({ played: 1, goalsFor: 7, goalsAgainst: 5, points: 3 });
  }, 60000);
});
