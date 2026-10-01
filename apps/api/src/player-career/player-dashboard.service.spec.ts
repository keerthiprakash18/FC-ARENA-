import { describe, expect, it, vi } from 'vitest';
import { PlayerDashboardService } from './player-dashboard.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { LeaguesService } from '../leagues/leagues.service.js';
import type { PlayerCareerService } from './player-career.service.js';

function setup(leagueIds = ['primary', 'secondary']) {
  const prisma = {
    tournament: { findMany: vi.fn().mockResolvedValue([]) },
    fixture: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const leagues = {
    getMyLeagues: vi
      .fn()
      .mockResolvedValue({
        data: { leagues: leagueIds.map((id) => ({ league: { id } })) },
      }),
  };
  const career = {
    getMyCareer: vi
      .fn()
      .mockResolvedValue({
        data: {
          profile: {},
          lifetimeStatistics: {},
          tournamentHistory: [],
          matchHistory: [],
        },
      }),
  };
  const service = new PlayerDashboardService(
    prisma as unknown as PrismaService,
    leagues as unknown as LeaguesService,
    career as unknown as PlayerCareerService,
  );
  return { prisma, leagues, career, service };
}

describe('personal dashboard summary', () => {
  it('includes both leagues and scopes every schedule query to the authenticated player', async () => {
    const { service, prisma, career } = setup();
    await service.getSummary('signed-in-player');
    expect(career.getMyCareer).toHaveBeenCalledWith('signed-in-player', true);
    for (const [query] of prisma.fixture.findMany.mock.calls) {
      expect(query.where.tournament.leagueId.in).toEqual([
        'primary',
        'secondary',
      ]);
      expect(query.where.OR).toEqual([
        {
          homeRegistration: {
            members: { some: { userId: 'signed-in-player' } },
          },
        },
        {
          awayRegistration: {
            members: { some: { userId: 'signed-in-player' } },
          },
        },
      ]);
      expect(query.where.status.notIn).toEqual(['COMPLETED', 'CANCELLED']);
      expect(query.where.tournament.status.notIn).toContain('COMPLETED');
      expect(query.where.AND[0].OR[1].match.status.notIn).toEqual([
        'COMPLETED',
        'CANCELLED',
      ]);
    }
  });

  it('keeps fixture query count and result limits fixed across many leagues', async () => {
    const { service, prisma } = setup(
      Array.from({ length: 100 }, (_, index) => `league-${index}`),
    );
    await service.getSummary('player');
    expect(prisma.fixture.findMany).toHaveBeenCalledTimes(3);
    for (const [query] of prisma.fixture.findMany.mock.calls)
      expect(query.take).toBe(10);
    expect(prisma.tournament.findMany.mock.calls[0][0].take).toBe(20);
  });

  it('returns secondary-league fixtures and preserves nullable opponents', async () => {
    const { service, prisma } = setup();
    prisma.fixture.findMany.mockResolvedValueOnce([
      {
        id: 'fixture',
        sequence: 1,
        scheduledAt: new Date(),
        status: 'SCHEDULED',
        match: null,
        homeRegistration: {
          id: 'registration',
          entryName: 'My team',
          members: [
            { user: { id: 'player', fullName: 'Player', player: null } },
          ],
        },
        awayRegistration: null,
        tournament: {
          id: 'secondary-tournament',
          name: 'Secondary cup',
          league: { name: 'Secondary league' },
        },
      },
    ]);
    const result = await service.getSummary('player');
    expect(result.data.fixtures[0]).toMatchObject({
      leagueName: 'Secondary league',
      tournamentId: 'secondary-tournament',
      away: null,
      home: { members: [{ id: 'player', inGameName: null }] },
    });
  });

  it('propagates fixture failures instead of returning a misleading empty success', async () => {
    const { service, prisma } = setup();
    prisma.fixture.findMany.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );
    await expect(service.getSummary('player')).rejects.toThrow(
      'Database unavailable',
    );
  });

  it('returns a genuine empty success when the account has no leagues', async () => {
    const { service, prisma } = setup([]);
    const result = await service.getSummary('player');
    expect(result.data.fixtures).toEqual([]);
    expect(
      prisma.fixture.findMany.mock.calls[0][0].where.tournament.leagueId.in,
    ).toEqual([]);
  });
});
