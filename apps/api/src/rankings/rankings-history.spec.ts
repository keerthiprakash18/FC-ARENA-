import { describe, it, expect, vi } from 'vitest';
import { RankingsService } from './rankings.service.js';
function setup(previous: Record<string, number> | null) {
  const statistic = (id: string, wins: number) => ({
    userId: id,
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
  return { prisma, service: new RankingsService(prisma) };
}
describe('Persisted rank comparison', () => {
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
