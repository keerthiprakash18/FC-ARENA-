import { describe, expect, it, vi } from 'vitest';
import { AchievementsService } from './achievements.service.js';
import { rankGoldenBootRace, rankGoldenGloveRace, tiedGoldenBootWinners, tiedGoldenGloveWinners, type AwardMetricRow } from './award-scoring.js';

function metric(userId: string, overrides: Partial<AwardMetricRow> = {}): AwardMetricRow {
  return { userId, matches: 4, wins: 2, draws: 1, losses: 1, goalsFor: 10, goalsAgainst: 4,
    goalDifference: 6, cleanSheets: 2, bigMatchPoints: 0, longestWinStreak: 2, ...overrides };
}

describe('consistent live award race positions', () => {
  it('gives exactly tied scorers a shared position and agrees with official winners', () => {
    const rows = [metric('b'), metric('a'), metric('c', { goalsFor: 5 })];
    const race = rankGoldenBootRace(rows);
    expect(race.map(row => [row.userId, row.position])).toEqual([['a', 1], ['b', 1], ['c', 3]]);
    expect(race.filter(row => row.position === 1).map(row => row.userId))
      .toEqual(tiedGoldenBootWinners(rows).map(row => row.userId));
  });

  it('excludes unplayed or goalless players without fabricating a Golden Boot leader', () => {
    const rows = [metric('unplayed', { matches: 0 }), metric('no-goals', { goalsFor: 0 })];
    expect(rankGoldenBootRace(rows)).toEqual([]);
    expect(tiedGoldenBootWinners(rows)).toEqual([]);
  });

  it('shares defensive race positions while retaining the clean sheet requirement for the trophy', () => {
    const rows = [metric('b'), metric('a'), metric('c', { cleanSheets: 0 })];
    expect(rankGoldenGloveRace(rows).map(row => row.position)).toEqual([1, 1, 3]);
    expect(tiedGoldenGloveWinners([metric('goalless-defence', { cleanSheets: 0 })])).toEqual([]);
  });

  it('returns the shared positions from the actual SOLO race endpoint', async () => {
    const rows = [metric('b'), metric('a'), metric('c', { goalsFor: 5 })];
    const prisma: any = {
      tournament: { findUnique: vi.fn().mockResolvedValue({ id: 'cup', leagueId: 'league', mode: 'SOLO' }) },
      leagueMember: { findUnique: vi.fn().mockResolvedValue({}) },
      playerTournamentStatistic: { findMany: vi.fn().mockResolvedValue(rows.map(row => ({ ...row,
        user: { fullName: row.userId, player: null } }))) },
    };
    const service = new AchievementsService(prisma, {} as any);
    vi.spyOn(service as any, 'buildTournamentAwardMetrics').mockResolvedValue(rows);
    const response = await service.getTournamentAwardRaces('a', 'cup');
    expect(response.data.goldenBoot.map(row => [row.userId, row.position])).toEqual([['a', 1], ['b', 1], ['c', 3]]);
    expect(response.data.goldenGlove.map(row => row.position)).toEqual([1, 1, 1]);
  });
  it('returns every verified SOLO player beyond the previous 20-person cap for all three races', async () => {
    const rows = Array.from({ length: 27 }, (_, index) => metric(
      `player-${String(index + 1).padStart(2, '0')}`,
      { goalsFor: index, goalDifference: index - 4, cleanSheets: index % 4 },
    ));
    const prisma: any = {
      tournament: { findUnique: vi.fn().mockResolvedValue({ id: 'cup', leagueId: 'league', mode: 'SOLO' }) },
      leagueMember: { findUnique: vi.fn().mockResolvedValue({}) },
      playerTournamentStatistic: { findMany: vi.fn().mockResolvedValue(rows.map(row => ({
        ...row, user: { fullName: row.userId, player: null },
      }))) },
    };
    const service = new AchievementsService(prisma, {} as any);
    vi.spyOn(service as any, 'buildTournamentAwardMetrics').mockResolvedValue(rows);
    const response = await service.getTournamentAwardRaces('member', 'cup');
    for (const race of [response.data.goldenBoot, response.data.goldenGlove, response.data.playerOfTournament]) {
      expect(race).toHaveLength(27);
      expect(new Set(race.map(row => row.userId)).size).toBe(27);
    }
    expect(response.data.goldenBoot[0].userId).toBe('player-27');
    expect(response.data.goldenBoot.at(-1)).toMatchObject({
      userId: 'player-01', goals: 0, matches: 4,
    });
    // A goalless participant can see their rank, but cannot receive a Golden Boot trophy.
    expect(tiedGoldenBootWinners([metric('goalless', { goalsFor: 0 })])).toEqual([]);
  });

});
