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
    ballonRankingSnapshot: { upsert: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
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
});
