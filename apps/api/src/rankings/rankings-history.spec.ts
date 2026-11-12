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

describe('read-only personal rank history', () => {
  it('returns observed days only and hides other users and full snapshot JSON', async () => {
    const { service, prisma } = setup(null);
    prisma.rankingSnapshot.findMany = vi.fn().mockResolvedValue([
      {
        day: new Date('2026-11-10T00:00:00Z'),
        capturedAt: new Date('2026-11-10T12:00:00Z'),
        positions: { one: 2, two: 1 },
      },
      {
        day: new Date('2026-11-11T00:00:00Z'),
        capturedAt: new Date('2026-11-11T12:00:00Z'),
        positions: { two: 1 },
      },
    ]);
    const result = await service.getMyLeagueRankHistory('one', 'league', 'solo');
    expect(result.data.scope).toBe('SOLO');
    expect(result.data.history.map((p) => p.position)).toEqual([2, null]);
    expect(JSON.stringify(result.data)).not.toContain('"two"');
    expect(prisma.rankingSnapshot.findMany.mock.calls[0][0]).toMatchObject({
      where: { leagueId: 'league', scope: 'SOLO' },
      take: 90,
      orderBy: { day: 'asc' },
    });
    expect(prisma.rankingSnapshot.upsert).not.toHaveBeenCalled();
  });

  it('blocks non-members before requesting private snapshots', async () => {
    const { service, prisma } = setup(null);
    prisma.rankingSnapshot.findMany = vi.fn();
    prisma.leagueMember.findUnique.mockResolvedValue(null);
    await expect(service.getMyLeagueRankHistory('outsider', 'league')).rejects.toThrow();
    expect(prisma.rankingSnapshot.findMany).not.toHaveBeenCalled();
  });

  it('does not invent prior history from an empty snapshot set', async () => {
    const { service, prisma } = setup(null);
    prisma.rankingSnapshot.findMany = vi.fn().mockResolvedValue([]);
    const result = await service.getMyLeagueRankHistory('one', 'league');
    expect(result.data.history).toEqual([]);
    expect(result.data.source).toBe('OBSERVED_DAILY_SNAPSHOTS');
  });
});

describe('stable league ties', () => {
  it('sorts identical names and scores using immutable player IDs', async () => {
    const { service, prisma } = setup(null);
    const sameStats = (id: string) => ({
      userId: id,
      user: { id, fullName: 'Same Name', player: null },
      matches: 1, wins: 1, draws: 0, losses: 0,
      goalsFor: 1, goalsAgainst: 0, goalDifference: 1,
      form: 'W', updatedAt: new Date('2026-11-12T00:00:00Z'),
    });
    prisma.playerTournamentStatistic.findMany.mockResolvedValue([
      sameStats('two'), sameStats('one'),
    ]);
    const result = await service.getLeagueRankings('one', 'league');
    expect(result.data.rankings.map(row => row.userId)).toEqual(['one', 'two']);
  });
});
