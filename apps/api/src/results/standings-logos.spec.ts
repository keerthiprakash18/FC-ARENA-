import { describe, expect, it, vi } from 'vitest';
import { PublicService } from '../public/public.service.js';
import { RankingsService } from '../rankings/rankings.service.js';

const standings = [
  { registrationId: 'one', registration: { entryName: 'First Club', entryLogoUrl: 'https://example.invalid/first.png', members: [] } },
  { registrationId: 'two', registration: { entryName: 'Second Club', entryLogoUrl: 'https://example.invalid/second.png', members: [] } },
  { registrationId: 'three', registration: { entryName: 'Without Logo', entryLogoUrl: null, members: [] } },
].map((row, index) => ({ ...row, played: 3, wins: 3 - index, draws: 0, losses: index,
  goalsFor: 6, goalsAgainst: index, goalDifference: 6 - index, points: 9 - index * 3, form: 'WWW' }));

describe('Registered club logos in points tables', () => {
  it('includes each registration logo on public rows even without groups', async () => {
    const prisma = { tournament: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue({
      id: 'cup', code: 'CUP', name: 'Cup', league: {}, groups: [], fixtures: [], standings, playerStatistics: [],
    }) } };
    const response = await new PublicService(prisma as never).getTournament('CUP');
    expect(response.data.groups).toEqual([]);
    expect(response.data.standings.map(row => [row.registrationId, row.logoUrl, row.points])).toEqual([
      ['one', 'https://example.invalid/first.png', 9],
      ['two', 'https://example.invalid/second.png', 6],
      ['three', null, 3],
    ]);
  });

  it('keeps club logos attached to the corresponding team ranking and preserves order', async () => {
    const prisma = {
      tournament: { findUnique: vi.fn().mockResolvedValue({ id: 'cup', leagueId: 'league', mode: 'TEAM' }) },
      leagueMember: { findUnique: vi.fn().mockResolvedValue({ id: 'membership' }) },
      playerTournamentStatistic: { findMany: vi.fn().mockResolvedValue([]) },
      tournamentStanding: { findMany: vi.fn().mockResolvedValue(standings) },
    };
    const response = await new RankingsService(prisma as never).getTournamentRankings('member', 'cup');
    expect(response.data.categories.bestTeams.entries.map(row => [row.registrationId, row.logoUrl, row.position])).toEqual([
      ['one', 'https://example.invalid/first.png', 1],
      ['two', 'https://example.invalid/second.png', 2],
      ['three', null, 3],
    ]);
  });
});
