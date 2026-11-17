import { describe, expect, it, vi } from 'vitest';
import { BallonService } from './ballon.service.js';

function fixture(sequence: number, homeScore: number, awayScore: number) {
  const member = (id: string) => ({ userId: id, user: { id, fullName: id, player: null } });
  return {
    id: `match-${sequence}`, tournamentId: 'cup', status: 'COMPLETED',
    confirmedResultSubmissionId: `result-${sequence}`,
    confirmedResult: { id: `result-${sequence}`, status: 'CONFIRMED', homeScore, awayScore,
      reviewedAt: new Date(`2026-10-${String(sequence + 1).padStart(2, '0')}T12:00:00Z`) },
    fixture: { id: `fixture-${sequence}`, sequence, matchday: sequence, roundNumber: sequence,
      phase: 'LEAGUE', status: 'COMPLETED', homeRegistrationId: 'home', awayRegistrationId: 'away',
      homeRegistration: { members: [member('home-player')] }, awayRegistration: { members: [member('away-player')] } },
  };
}
function setup() {
  const season = { id: 'season', status: 'LIVE', startAt: new Date('2026-10-01'), endAt: new Date('2026-10-31'),
    minimumMatches: 1, maximumMatches: 2, rankingLimit: 20, eligibleLeagueIds: ['league'], eligibleTournamentIds: [],
    tournamentRequirements: { SOLO: 0, DUO: 0, TEAM: 0 }, scoringConfig: null };
  const matches = [fixture(1, 9, 0), fixture(2, 0, 1)];
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }), findMany: vi.fn().mockResolvedValue([]) },
    ballonSeason: { findUnique: vi.fn().mockImplementation(async () => season) },
    tournament: { findMany: vi.fn().mockResolvedValue([{ id: 'cup', mode: 'SOLO', competitionFormat: 'CUSTOM_MANUAL', legType: 'SINGLE_LEG' }]) },
    match: { findMany: vi.fn().mockImplementation(async () => matches) },
    achievement: { findMany: vi.fn().mockResolvedValue([]) },
    tournamentRegistrationMember: { findMany: vi.fn().mockResolvedValue([]) },
    seasonalAward: { findMany: vi.fn().mockResolvedValue([]) },
    ballonRankingSnapshot: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ballonFinalRanking: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const service = new BallonService(prisma as any);
  const read = async () => (await service.getRankings('viewer', 'season', 'all')).data;
  return { season, matches, prisma, read };
}
describe('Ballon live ranking calculation', () => {
  it('recalculates confirmed results, caps the latest N per player, and applies corrections and reversals', async () => {
    const { matches, read } = setup();
    let data = await read();
    const home = () => data.rows.find((row: any) => row.userId === 'home-player') as any;
    expect(home()).toMatchObject({ matches: 2, wins: 1, goalsFor: 9, goalsAgainst: 1 });
    matches.push(fixture(3, 0, 2));
    data = await read();
    expect(home()).toMatchObject({ matches: 2, wins: 0, losses: 2, goalsFor: 0, goalsAgainst: 3 });
    expect(data.rows[0].userId).toBe('away-player');
    matches[2].confirmedResult.homeScore = 4;
    matches[2].confirmedResult.awayScore = 0;
    data = await read();
    expect(home()).toMatchObject({ matches: 2, wins: 1, goalsFor: 4, goalsAgainst: 1 });
    matches[2].confirmedResult.status = 'REJECTED';
    data = await read();
    expect(home()).toMatchObject({ matches: 2, wins: 1, goalsFor: 9, goalsAgainst: 1 });
  });
  it('excludes stale pointers, unconfirmed/out-of-window results and duplicate fixtures', async () => {
    const { matches, prisma, read } = setup();
    matches.push(structuredClone(matches[0]));
    const stale = fixture(3, 8, 0); stale.confirmedResultSubmissionId = 'stale'; matches.push(stale);
    const old = fixture(4, 8, 0); old.confirmedResult.reviewedAt = new Date('2026-09-30'); matches.push(old);
    const future = fixture(5, 8, 0); future.confirmedResult.reviewedAt = new Date('2026-11-02'); matches.push(future);
    const pending = fixture(6, 8, 0); pending.confirmedResult.status = 'PENDING'; matches.push(pending);
    const data = await read();
    expect((data.rows.find((row: any) => row.userId === 'home-player') as any)).toMatchObject({ matches: 2, goalsFor: 9 });
    expect(prisma.tournament.findMany.mock.calls[0][0].where.OR).toEqual([{ leagueId: { in: ['league'] } }]);
  });
  it('keeps insufficient-match players visible and honors custom caps and locked season snapshots', async () => {
    const { season, matches, prisma, read } = setup();
    season.minimumMatches = 3; season.maximumMatches = 3;
    expect((await read()).rows.every((row: any) => !row.eligible)).toBe(true);
    matches.push(fixture(3, 3, 1));
    expect((await read()).rows.every((row: any) => row.eligible && row.matches === 3)).toBe(true);
    season.status = 'LOCKED';
    prisma.match.findMany.mockClear();
    expect((await read()).locked).toBe(true);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });
  it('keeps one-match players unranked in a tournament view and never writes a season snapshot', async () => {
    const { season, matches, prisma } = setup();
    season.maximumMatches = 5;
    const readTournament = async () =>
      (await new BallonService(prisma as any).getRankings('viewer', 'season', 'all', 'cup')).data;
    const originalCount = prisma.ballonRankingSnapshot.upsert.mock.calls.length;
    let response = await readTournament();
    expect(response.tournamentView).toBe(true);
    expect(response.tournaments).toEqual([{ id: 'cup', name: undefined, mode: 'SOLO' }]);
    expect(response.rows.every((row: any) => !row.eligible && row.position === 0)).toBe(true);
    expect(response.rows[0].eligibilityReasons).toContain('2/3 matches');
    expect(prisma.ballonRankingSnapshot.upsert.mock.calls.length).toBe(originalCount);
    matches.push(fixture(3, 3, 0));
    response = await readTournament();
    expect(response.rows.every((row: any) => row.eligible && row.position > 0)).toBe(true);
    expect(prisma.ballonRankingSnapshot.upsert.mock.calls.length).toBe(originalCount);
  });

  it('rejects out-of-season tournament filters instead of leaking cross-league results', async () => {
    const { prisma } = setup();
    const service = new BallonService(prisma as any);
    await expect(service.getRankings('viewer', 'season', 'all', 'outside-cup'))
      .rejects.toMatchObject({ status: 404 });
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it('does not let a one-match scoring outlier change the qualified leaders ratings', async () => {
    const { season, matches, read } = setup();
    season.minimumMatches = 3;
    season.maximumMatches = 5;
    matches.push(fixture(3, 2, 2));
    const before = await read();
    const byId = (rows: any[]) => new Map(rows.map((row) => [row.userId, row.rating]));
    const firstRatings = byId(before.rows);
    const newcomerMatch = fixture(4, 99, 0);
    newcomerMatch.fixture.homeRegistration.members[0].userId = 'newcomer';
    newcomerMatch.fixture.awayRegistration.members[0].userId = 'other-newcomer';
    matches.push(newcomerMatch);
    const after = await read();
    const nextRatings = byId(after.rows);
    expect(nextRatings.get('home-player')).toEqual(firstRatings.get('home-player'));
    expect(nextRatings.get('away-player')).toEqual(firstRatings.get('away-player'));
    expect(after.rows.filter((row: any) => !row.eligible)).toHaveLength(2);
    expect(after.rows.filter((row: any) => !row.eligible).every((row: any) => row.position === 0)).toBe(true);
  });

  it('creates one current-day snapshot when none exists and preserves all historical days', async () => {
    const { season, matches, prisma, read } = setup();
    season.maximumMatches = 3; // All three confirmed games must count to qualify.
    matches.push(fixture(3, 2, 0));
    await read();
    expect(prisma.ballonRankingSnapshot.upsert).toHaveBeenCalledTimes(1);
    const inserted = prisma.ballonRankingSnapshot.upsert.mock.calls[0][0];
    expect(inserted.create.rows).toHaveLength(2);
    expect(inserted.create.day.toISOString().endsWith('T00:00:00.000Z')).toBe(true);
    expect(inserted.update).toEqual({});
    expect(prisma.ballonRankingSnapshot.updateMany).not.toHaveBeenCalled();
  });

  it('refreshes stale live snapshots without writing on frequent ranking polls', async () => {
    const { season, matches, prisma, read } = setup();
    season.maximumMatches = 3; // All three confirmed games must count to qualify.
    matches.push(fixture(3, 2, 0));
    prisma.ballonRankingSnapshot.findUnique.mockResolvedValue({
      capturedAt: new Date(Date.now() - 120_000),
    });
    await read();
    expect(prisma.ballonRankingSnapshot.upsert).not.toHaveBeenCalled();
    expect(prisma.ballonRankingSnapshot.updateMany).toHaveBeenCalledTimes(1);
    const refreshed = prisma.ballonRankingSnapshot.updateMany.mock.calls[0][0];
    expect(refreshed.data.rows).toHaveLength(2);
    expect(refreshed.where.seasonId).toBe('season');
    expect(refreshed.where.day.toISOString().endsWith('T00:00:00.000Z')).toBe(true);
    expect(refreshed.where.capturedAt.lte).toBeInstanceOf(Date);
    prisma.ballonRankingSnapshot.updateMany.mockClear();
    prisma.ballonRankingSnapshot.findUnique.mockResolvedValue({
      capturedAt: new Date(),
    });
    await read();
    expect(prisma.ballonRankingSnapshot.updateMany).not.toHaveBeenCalled();
  });

  it('never updates the daily snapshot after a season is locked', async () => {
    const { season, matches, prisma, read } = setup();
    matches.push(fixture(3, 2, 0));
    season.status = 'LOCKED';
    await read();
    expect(prisma.ballonRankingSnapshot.findUnique).not.toHaveBeenCalled();
    expect(prisma.ballonRankingSnapshot.upsert).not.toHaveBeenCalled();
    expect(prisma.ballonRankingSnapshot.updateMany).not.toHaveBeenCalled();
  });

});
