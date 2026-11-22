import { describe, expect, it, vi } from 'vitest';
import { RankingsService } from './rankings.service.js';

function statistic(userId: string, overrides: Record<string, unknown> = {}) {
  return { userId, tournamentId: 'cup', matches: 4, wins: 2, draws: 1, losses: 1,
    goalsFor: 8, goalsAgainst: 4, goalDifference: 4, form: 'WWDL',
    user: { id: userId, fullName: userId, player: null }, ...overrides };
}

function setup(rows: ReturnType<typeof statistic>[], mode = 'SOLO') {
  const prisma: any = {
    tournament: { findUnique: vi.fn().mockResolvedValue({ id: 'cup', leagueId: 'league', mode }) },
    leagueMember: { findUnique: vi.fn().mockResolvedValue({}) },
    playerTournamentStatistic: { findMany: vi.fn().mockResolvedValue(rows) },
    tournamentStanding: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new RankingsService(prisma) };
}

describe('tournament leaderboard regressions', () => {
  it('keeps every played participant and their own position beyond the first twenty', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => statistic(`player-${String(index).padStart(2, '0')}`));
    const { service } = setup(rows.reverse());
    const response = await service.getTournamentRankings('player-24', 'cup');
    expect(response.data.myPosition).toBe(25);
    for (const category of ['bestPlayers', 'mostWins', 'highestWinRate', 'bestGoalDifference'] as const) {
      expect(response.data.categories[category]).toHaveLength(25);
    }
    expect(response.data.categories.topGoals.entries).toHaveLength(25);
  });

  it('never ranks an unplayed registration above players with verified losses', async () => {
    const { service } = setup([
      statistic('unplayed', { matches: 0, wins: 0, draws: 0, goalsFor: 0, goalDifference: 0 }),
      statistic('played', { wins: 0, draws: 0, losses: 4, goalsFor: 0, goalDifference: -4 }),
    ]);
    const response = await service.getTournamentRankings('unplayed', 'cup');
    expect(response.data.myPosition).toBeNull();
    expect(response.data.categories.bestPlayers.map(row => row.userId)).toEqual(['played']);
    expect(response.data.categories.bestGoalDifference.map(row => row.userId)).toEqual(['played']);
    expect(response.data.categories.topGoals.entries).toEqual([]);
  });

  it('uses the same Golden Boot tie-breaks as the award race, including shared positions', async () => {
    const { service } = setup([
      statistic('volume', { matches: 8, goalsFor: 10, wins: 5 }),
      statistic('efficient-b', { matches: 4, goalsFor: 10, wins: 2 }),
      statistic('efficient-a', { matches: 4, goalsFor: 10, wins: 2 }),
    ]);
    const response = await service.getTournamentRankings('volume', 'cup');
    expect(response.data.categories.topGoals.entries.map(row => [row.userId, row.position])).toEqual([
      ['efficient-a', 1], ['efficient-b', 1], ['volume', 3],
    ]);
  });

  it('keeps aggregate team scores out of the individual goals leaderboard', async () => {
    const { service } = setup([statistic('member')], 'TEAM');
    const response = await service.getTournamentRankings('member', 'cup');
    expect(response.data.categories.topGoals).toMatchObject({ available: false, entries: [] });
  });

  it('authorizes the league membership before reading statistics', async () => {
    const { service, prisma } = setup([]);
    prisma.leagueMember.findUnique.mockResolvedValue(null);
    await expect(service.getTournamentRankings('outsider', 'cup')).rejects.toThrow();
    expect(prisma.playerTournamentStatistic.findMany).not.toHaveBeenCalled();
  });
});
