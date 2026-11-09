import { describe, it, expect, vi } from 'vitest';
import { RankingsService } from './rankings.service.js';
function setup(previous: Record<string, number> | null) {
  const statistic = (id: string, wins: number) => ({
    userId: id,
    tournamentId: 'cup',
    user: { id, fullName: id, player: null },
    matches: 3,
    wins,
    draws: 0,
    losses: 3 - wins,
    goalsFor: 5,
    goalsAgainst: 2,
    goalDifference: 3,
    form: 'WLW',
    updatedAt: new Date(),
  });
  const prisma: any = {
    leagueMember: { findUnique: vi.fn().mockResolvedValue({}) },
    league: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: 'league',
          name: 'League',
          code: 'CODE',
          members: [{ userId: 'one' }, { userId: 'two' }],
        }),
    },
    playerTournamentStatistic: {
      findMany: vi
        .fn()
        .mockResolvedValue([statistic('one', 3), statistic('two', 1)]),
    },
    tournament: { count: vi.fn().mockResolvedValue(1) },
    tournamentRegistrationMember: { findMany: vi.fn().mockResolvedValue([]) },
    match: { count: vi.fn().mockResolvedValue(3) },
    rankingSnapshot: {
      upsert: vi.fn().mockResolvedValue({}),
      findFirst: vi
        .fn()
        .mockResolvedValue(
          previous
            ? {
                positions: previous,
                capturedAt: new Date('2026-09-01T12:00:00Z'),
              }
            : null,
        ),
    },
  };
  return { prisma, statistic, service: new RankingsService(prisma) };
}
describe('Persisted rank comparison', () => {
  it('labels players with their tournament entry without changing their score or league rank', async () => {
    const { service, prisma } = setup(null);
    prisma.tournamentRegistrationMember.findMany.mockResolvedValue([
      { userId: 'one', registrationId: 'south-korea', registration: { entryName: 'South Korea', tournamentId: 'cup', tournament: { name: 'International friendlies' } } },
      { userId: 'one', registrationId: 'future-entry', registration: { entryName: 'Future team', tournamentId: 'future-cup', tournament: { name: 'Not played yet' } } },
    ]);
    const response = await service.getLeagueRankings('one', 'league', 'SOLO');
    expect(response.data.rankings[0]).toMatchObject({ userId: 'one', performancePoints: 9, position: 1,
      entries: [{ registrationId: 'south-korea', tournamentId: 'cup', entryName: 'South Korea', tournamentName: 'International friendlies' }],
    });
    expect(response.data.rankings[0].entries).toHaveLength(1);
    expect(prisma.tournamentRegistrationMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tournament: { leagueId: 'league', status: { not: 'CANCELLED' }, mode: 'SOLO' }, registration: { status: 'APPROVED' } },
    }));
  });
  it('keeps players beyond rank 100 visible and returns their own rank', async () => {
    const { service, prisma, statistic } = setup(null);
    const rows = Array.from({ length: 105 }, (_, i) => statistic(`player-${String(i).padStart(3, '0')}`, 1));
    prisma.playerTournamentStatistic.findMany.mockResolvedValue(rows);
    prisma.league.findUnique.mockResolvedValue({ id: 'league', name: 'League', members: rows.map(row => ({ userId: row.userId })) });
    const response = await service.getLeagueRankings('player-104', 'league');
    expect(response.data.rankings).toHaveLength(105);
    expect(response.data.myPosition).toBe(105);
    expect(response.data.summary.rankedPlayers).toBe(105);
  });
  it('does not invent movement before a previous-day snapshot exists', async () => {
    const { service, prisma } = setup(null);
    const result = await service.getLeagueRankings('one', 'league');
    expect(result.data.rankings[0].rankChange).toBeNull();
    expect(prisma.rankingSnapshot.upsert.mock.calls[0][0].update).toEqual({});
  });
  it('compares by stable account ID within the selected competition mode', async () => {
    const { service, prisma } = setup({ one: 2, two: 1 });
    const result = await service.getLeagueRankings('one', 'league', 'solo');
    expect(result.data.rankings.map((r) => r.rankChange)).toEqual([1, -1]);
    expect(prisma.rankingSnapshot.findFirst.mock.calls[0][0].where.scope).toBe(
      'SOLO',
    );
  });
  it('requires league membership before reading or writing snapshots', async () => {
    const { service, prisma } = setup(null);
    prisma.leagueMember.findUnique.mockResolvedValue(null);
    await expect(
      service.getLeagueRankings('outsider', 'league'),
    ).rejects.toThrow();
    expect(prisma.rankingSnapshot.upsert).not.toHaveBeenCalled();
  });
});
