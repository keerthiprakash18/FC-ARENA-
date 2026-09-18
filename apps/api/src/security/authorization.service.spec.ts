import {
  ForbiddenException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AuthorizationService,
} from './authorization.service.js';

describe(
  'AuthorizationService',
  () => {
    let prisma: any;
    let service:
      AuthorizationService;

    beforeEach(() => {
      prisma = {
        user: {
          findUnique:
            vi.fn(),
        },

        leagueAdmin: {
          findUnique:
            vi.fn(),
        },

        roleAssignment: {
          findUnique:
            vi.fn(),
        },

        tournament: {
          findUnique:
            vi.fn(),
        },

        match: {
          findUnique:
            vi.fn(),
        },
      };

      service =
        new AuthorizationService(
          prisma,
        );
    });

    it(
      'allows SUPER_ADMIN to manage any league',
      async () => {
        prisma.user.findUnique.mockResolvedValue({
          role:
            'SUPER_ADMIN',
        });

        await expect(
          service.isLeagueAdmin(
            'super-user',
            'league-1',
          ),
        ).resolves.toBe(
          true,
        );

        expect(
          prisma.leagueAdmin
            .findUnique,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'allows an assigned League Admin',
      async () => {
        prisma.user.findUnique.mockResolvedValue({
          role:
            'PLAYER',
        });

        prisma.leagueAdmin.findUnique.mockResolvedValue({
          id:
            'admin-role-1',
        });

        await expect(
          service.isLeagueAdmin(
            'user-1',
            'league-1',
          ),
        ).resolves.toBe(
          true,
        );
      },
    );

    it(
      'rejects a normal player from League Admin actions',
      async () => {
        prisma.user.findUnique.mockResolvedValue({
          role:
            'PLAYER',
        });

        prisma.leagueAdmin.findUnique.mockResolvedValue(
          null,
        );

        await expect(
          service.assertLeagueAdmin(
            'player-1',
            'league-1',
          ),
        ).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );

    it(
      'allows tournament creator to manage own tournament',
      async () => {
        prisma.tournament.findUnique.mockResolvedValue({
          id:
            'tournament-1',

          leagueId:
            'league-1',

          createdByUserId:
            'creator-1',
        });

        prisma.user.findUnique.mockResolvedValue({
          role:
            'PLAYER',
        });

        prisma.leagueAdmin.findUnique.mockResolvedValue(
          null,
        );

        await expect(
          service.canManageTournament(
            'creator-1',
            'tournament-1',
          ),
        ).resolves.toBe(
          true,
        );
      },
    );

    it(
      'allows scoped TOURNAMENT_ADMIN',
      async () => {
        prisma.tournament.findUnique.mockResolvedValue({
          id:
            'tournament-1',

          leagueId:
            'league-1',

          createdByUserId:
            'other-user',
        });

        prisma.user.findUnique.mockResolvedValue({
          role:
            'PLAYER',
        });

        prisma.leagueAdmin.findUnique.mockResolvedValue(
          null,
        );

        prisma.roleAssignment.findUnique.mockResolvedValue({
          id:
            'role-1',
        });

        await expect(
          service.canManageTournament(
            'tournament-admin',
            'tournament-1',
          ),
        ).resolves.toBe(
          true,
        );
      },
    );

    it(
      'rejects user with no tournament permission',
      async () => {
        prisma.tournament.findUnique.mockResolvedValue({
          id:
            'tournament-1',

          leagueId:
            'league-1',

          createdByUserId:
            'creator-1',
        });

        prisma.user.findUnique.mockResolvedValue({
          role:
            'PLAYER',
        });

        prisma.leagueAdmin.findUnique.mockResolvedValue(
          null,
        );

        prisma.roleAssignment.findUnique.mockResolvedValue(
          null,
        );

        await expect(
          service.assertCanManageTournament(
            'unauthorized-player',
            'tournament-1',
          ),
        ).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );

    it(
      'allows MATCH_OFFICIAL to manage fixtures',
      async () => {
        prisma.tournament.findUnique
          .mockResolvedValueOnce({
            id:
              'tournament-1',

            leagueId:
              'league-1',

            createdByUserId:
              'creator-1',
          })
          .mockResolvedValueOnce({
            leagueId:
              'league-1',
          });

        prisma.user.findUnique.mockResolvedValue({
          role:
            'PLAYER',
        });

        prisma.leagueAdmin.findUnique.mockResolvedValue(
          null,
        );

        prisma.roleAssignment.findUnique
          .mockResolvedValueOnce(
            null,
          )
          .mockResolvedValueOnce(
            null,
          )
          .mockResolvedValueOnce({
            id:
              'official-role',
          });

        await expect(
          service.canManageFixtures(
            'official-1',
            'tournament-1',
          ),
        ).resolves.toBe(
          true,
        );
      },
    );

    it(
      'allows MATCH_OFFICIAL to verify a result',
      async () => {
        prisma.match.findUnique.mockResolvedValue({
          tournamentId:
            'tournament-1',

          tournament: {
            leagueId:
              'league-1',
          },
        });

        prisma.tournament.findUnique.mockResolvedValue({
          id:
            'tournament-1',

          leagueId:
            'league-1',

          createdByUserId:
            'creator-1',
        });

        prisma.user.findUnique.mockResolvedValue({
          role:
            'PLAYER',
        });

        prisma.leagueAdmin.findUnique.mockResolvedValue(
          null,
        );

        prisma.roleAssignment.findUnique
          .mockResolvedValueOnce(
            null,
          )
          .mockResolvedValueOnce(
            null,
          )
          .mockResolvedValueOnce({
            id:
              'official-role',
          });

        await expect(
          service.canVerifyResult(
            'official-1',
            'match-1',
          ),
        ).resolves.toBe(
          true,
        );
      },
    );

    it(
      'rejects normal player from result verification',
      async () => {
        prisma.match.findUnique.mockResolvedValue({
          tournamentId:
            'tournament-1',

          tournament: {
            leagueId:
              'league-1',
          },
        });

        prisma.tournament.findUnique.mockResolvedValue({
          id:
            'tournament-1',

          leagueId:
            'league-1',

          createdByUserId:
            'creator-1',
        });

        prisma.user.findUnique.mockResolvedValue({
          role:
            'PLAYER',
        });

        prisma.leagueAdmin.findUnique.mockResolvedValue(
          null,
        );

        prisma.roleAssignment.findUnique.mockResolvedValue(
          null,
        );

        await expect(
          service.assertCanVerifyResult(
            'normal-player',
            'match-1',
          ),
        ).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );
  },
);