import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import {
  BallonService,
} from './ballon.service.js';

function basePrisma() {
  return {
    user: {
      findUnique:
        vi.fn().mockResolvedValue({
          role:
            'SUPER_ADMIN',
          status:
            'ACTIVE',
        }),
      findMany:
        vi.fn().mockResolvedValue(
          [],
        ),
    },

    league: {
      count:
        vi.fn().mockResolvedValue(
          0,
        ),
    },

    leagueAdmin: {
      findMany:
        vi.fn().mockResolvedValue(
          [],
        ),
    },

    tournament: {
      findMany:
        vi.fn().mockResolvedValue(
          [],
        ),
    },

    ballonSeason: {
      create:
        vi.fn().mockImplementation(
          async ({
            data,
          }: any) => ({
            id:
              'season-1',
            status:
              'DRAFT',
            ...data,
          }),
        ),

      findUnique:
        vi.fn(),

      update:
        vi.fn(),

      findMany:
        vi.fn().mockResolvedValue(
          [],
        ),

      findFirst:
        vi.fn().mockResolvedValue(
          null,
        ),
    },

    ballonFinalRanking: {
      findMany:
        vi.fn().mockResolvedValue(
          [],
        ),
    },

    seasonalAward: {
      findMany:
        vi.fn().mockResolvedValue(
          [],
        ),
    },
  };
}

function dto(
  startAt: string,
  endAt: string,
) {
  return {
    name:
      'FC Arena Ballon Test',
    startAt,
    endAt,
    eligibleLeagueIds:
      [],
    eligibleTournamentIds:
      [],
  };
}

describe('BallonService rules', () => {
  it.each([
    [
      '2026-10-01T00:00:00.000Z',
      '2026-10-31T23:59:59.000Z',
      6,
    ],
    [
      '2026-10-01T00:00:00.000Z',
      '2026-11-30T23:59:59.000Z',
      10,
    ],
    [
      '2026-10-01T00:00:00.000Z',
      '2026-12-31T23:59:59.000Z',
      15,
    ],
  ])(
    'uses duration-aware minimum matches',
    async (
      startAt,
      endAt,
      expectedMinimum,
    ) => {
      const prisma =
        basePrisma();

      const service =
        new BallonService(
          prisma as any,
        );

      const response:
        any =
        await service.createSeason(
          'admin',
          dto(
            startAt,
            endAt,
          ),
        );

      expect(
        response.data.season
          .minimumMatches,
      ).toBe(
        expectedMinimum,
      );
    },
  );

  it('rejects invalid scoring totals', async () => {
    const prisma =
      basePrisma();

    const service =
      new BallonService(
        prisma as any,
      );

    await expect(
      service.createSeason(
        'admin',
        {
          ...dto(
            '2026-10-01T00:00:00.000Z',
            '2026-10-31T23:59:59.000Z',
          ),

          scoringConfig: {
            matchPerformance:
              30,
            attack: 20,
            defence: 15,
            goalDifference:
              15,
            bigMatches: 15,
            consistency: 10,
          },
        },
      ),
    ).rejects.toBeTruthy();
  });

  it('freezes configuration after DRAFT', async () => {
    const prisma =
      basePrisma();

    prisma.ballonSeason
      .findUnique
      .mockResolvedValue({
        id: 'season-1',
        status: 'LIVE',
        startAt:
          new Date(
            '2026-10-01T00:00:00.000Z',
          ),
        endAt:
          new Date(
            '2026-12-31T23:59:59.000Z',
          ),
        eligibleLeagueIds:
          [],
        eligibleTournamentIds:
          [],
        scoringConfig: {
          matchPerformance:
            30,
          attack: 20,
          defence: 15,
          goalDifference: 15,
          bigMatches: 15,
          consistency: 5,
        },
      });

    const service =
      new BallonService(
        prisma as any,
      );

    await expect(
      service.updateSeason(
        'admin',
        'season-1',
        {
          name:
            'Changed',
        },
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('blocks early finalization', async () => {
    const prisma =
      basePrisma();

    prisma.ballonSeason
      .findUnique
      .mockResolvedValue({
        id: 'season-1',
        status: 'LIVE',
        startAt:
          new Date(
            '2099-01-01T00:00:00.000Z',
          ),
        endAt:
          new Date(
            '2099-02-01T00:00:00.000Z',
          ),
        eligibleLeagueIds:
          [],
        eligibleTournamentIds:
          [],
      });

    const service =
      new BallonService(
        prisma as any,
      );

    await expect(
      service.finalizeSeason(
        'admin',
        'season-1',
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not expose DRAFT seasons to ordinary users by id', async () => {
    const prisma =
      basePrisma();

    prisma.user
      .findUnique
      .mockResolvedValue({
        role: 'USER',
        status: 'ACTIVE',
      });

    prisma.ballonSeason
      .findUnique
      .mockResolvedValue({
        id: 'season-1',
        status: 'DRAFT',
        eligibleLeagueIds:
          [],
        eligibleTournamentIds:
          [],
        rankingLimit: 20,
      });

    const service =
      new BallonService(
        prisma as any,
      );

    await expect(
      service.getSeason(
        'player',
        'season-1',
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows locked historical seasons to remain readable', async () => {
    const prisma =
      basePrisma();

    prisma.user
      .findUnique
      .mockResolvedValue({
        role: 'USER',
        status: 'ACTIVE',
      });

    prisma.ballonSeason
      .findUnique
      .mockResolvedValue({
        id: 'season-1',
        status: 'LOCKED',
        rankingLimit: 20,
        eligibleLeagueIds:
          [],
        eligibleTournamentIds:
          [],
      });

    const service =
      new BallonService(
        prisma as any,
      );

    const response:
      any =
      await service.getSeason(
        'player',
        'season-1',
      );

    expect(
      response.data.rankings
        .locked,
    ).toBe(true);
  });

  it('rejects a non-admin global season creation', async () => {
    const prisma =
      basePrisma();

    prisma.user
      .findUnique
      .mockResolvedValue({
        role: 'USER',
        status: 'ACTIVE',
      });

    const service =
      new BallonService(
        prisma as any,
      );

    await expect(
      service.createSeason(
        'player',
        dto(
          '2026-10-01T00:00:00.000Z',
          '2026-10-31T23:59:59.000Z',
        ),
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
