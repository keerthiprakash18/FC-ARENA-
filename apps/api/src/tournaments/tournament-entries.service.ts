import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';

import type {
  BulkCreateTournamentEntriesDto,
} from './dto/bulk-create-tournament-entries.dto.js';

import type {
  CreateTournamentEntryDto,
} from './dto/create-tournament-entry.dto.js';

import type {
  ReorderTournamentEntriesDto,
} from './dto/reorder-tournament-entries.dto.js';

import type {
  UpdateTournamentEntryDto,
} from './dto/update-tournament-entry.dto.js';

import {
  deduplicateFixtureRecords,
} from './fixture-deduplication.js';
import { assertUniqueEntryName, normalizeEntryName } from './entry-name.js';


@Injectable()
export class TournamentEntriesService {
  constructor(
    private readonly prisma:
      PrismaService,
    private readonly authorization:
      AuthorizationService,
  ) {}


  async listEntries(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },

        select: {
          id: true,
          leagueId: true,
          maxEntries: true,
          status: true,
          competitionFormat: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

    const entries =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,

          status: {
            in: [
              'APPROVED',
              'PENDING',
            ],
          },
        },

        orderBy: [
          {
            sortOrder:
              'asc',
          },
          {
            createdAt:
              'asc',
          },
        ],

        include: {
          registeredBy: {
            select: {
              id: true,
              fullName: true,
            },
          },

          members: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,

                  player: {
                    select: {
                      playerCode: true,

                      identity: {
                        select: {
                          inGameName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },

        },
      });

    const rawFixtures =
      await this.prisma.fixture.findMany({
        where: {
          tournamentId,
        },

        select: {
          id: true,
          groupId: true,
          sequence: true,
          homeRegistrationId: true,
          awayRegistrationId: true,
          status: true,

          match: {
            select: {
              status: true,
              confirmedResultSubmissionId:
                true,
            },
          },
        },
      });

    const canonicalFixtures =
      deduplicateFixtureRecords(
        rawFixtures,
        tournament.competitionFormat,
      );

    const fixtureCounts =
      new Map<string, number>();

    for (
      const fixture
      of canonicalFixtures
    ) {
      for (
        const registrationId
        of [
          fixture.homeRegistrationId,
          fixture.awayRegistrationId,
        ]
      ) {
        if (
          !registrationId
        ) {
          continue;
        }

        fixtureCounts.set(
          registrationId,
          (
            fixtureCounts.get(
              registrationId,
            ) ??
            0
          ) +
            1,
        );
      }
    }

    return {
      success: true,

      data: {
        maxEntries:
          tournament.maxEntries,

        entries:
          entries.map(
            (entry) => ({
              ...entry,

              fixtureCount:
                fixtureCounts.get(
                  entry.id,
                ) ??
                0,
            }),
          ),
      },

      error: null,
    };
  }


  async createEntry(
    userId: string,
    tournamentId: string,
    dto: CreateTournamentEntryDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    await this.assertEntriesEditable(
      tournamentId,
      tournament.status,
    );

    const entryName =
      dto.entryName.trim();

    if (!entryName) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'ENTRY_NAME_REQUIRED',

          message:
            'Team name is required.',
        },
      });
    }

    const entry = await this.prisma.$transactionWithRetry(async (tx) => {
      await assertUniqueEntryName(tx, tournamentId, entryName);
      const currentCount = await tx.tournamentRegistration.count({
        where: { tournamentId, status: { in: ['APPROVED', 'PENDING'] } },
      });

      if (currentCount >= tournament.maxEntries) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code: 'TOURNAMENT_ENTRY_LIMIT_REACHED',
            message: `This Tournament allows a maximum of ${tournament.maxEntries} entries.`,
          },
        });
      }

      const latest = await tx.tournamentRegistration.findFirst({
        where: { tournamentId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });

      return tx.tournamentRegistration.create({
        data: {
          tournamentId,

          registeredByUserId:
            userId,

          entryName,

          entryLogoUrl:
            dto.entryLogoUrl?.trim() ||
            null,

          sortOrder:
            (latest?.sortOrder ??
              -1) + 1,

          status:
            'APPROVED',

          reviewedByUserId:
            userId,

          reviewedAt:
            new Date(),
        },
      });
    }, { isolationLevel: 'Serializable' });

    return {
      success: true,

      data: {
        message:
          'Team added successfully.',

        entry,
      },

      error: null,
    };
  }


  async bulkCreateEntries(
    userId: string,
    tournamentId: string,
    dto: BulkCreateTournamentEntriesDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    await this.assertEntriesEditable(
      tournamentId,
      tournament.status,
    );

    const names =
      dto.names
        .map(
          (name) =>
            name.trim(),
        )
        .filter(Boolean);

    const normalized =
      names.map(
        (name) =>
          normalizeEntryName(name),
      );

    if (
      new Set(
        normalized,
      ).size !==
      normalized.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'DUPLICATE_BULK_ENTRY',

          message:
            'Bulk list contains duplicate team names.',
        },
      });
    }

    await this.prisma.$transactionWithRetry(async (tx) => {
      const existing = await tx.tournamentRegistration.findMany({
        where: { tournamentId, status: { in: ['APPROVED', 'PENDING'] } },
        select: { entryName: true },
      });

      const existingNames = new Set(
        existing.map((entry) => entry.entryName ? normalizeEntryName(entry.entryName) : '').filter(Boolean),
      );
      const duplicates = names.filter((name) => existingNames.has(normalizeEntryName(name)));
      if (duplicates.length > 0) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code: 'ENTRY_NAME_ALREADY_EXISTS',
            message: `These team(s) already exist in this Tournament: ${duplicates.join(', ')}.`,
          },
        });
      }

      if (existing.length + names.length > tournament.maxEntries) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code: 'TOURNAMENT_ENTRY_LIMIT_REACHED',
            message: `Only ${Math.max(0, tournament.maxEntries - existing.length)} more team(s) can be added.`,
          },
        });
      }

      const latest = await tx.tournamentRegistration.findFirst({
        where: { tournamentId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      const startOrder = (latest?.sortOrder ?? -1) + 1;
      await Promise.all(
        names.map((entryName, index) =>
          tx.tournamentRegistration.create({
            data: {
              tournamentId,

              registeredByUserId:
                userId,

              entryName,

              sortOrder:
                startOrder +
                index,

              status:
                'APPROVED',

              reviewedByUserId:
                userId,

              reviewedAt:
                new Date(),
            },
          }),
        ),
      );
    }, { isolationLevel: 'Serializable' });

    return {
      success: true,

      data: {
        message:
          `${names.length} team(s) added successfully.`,

        created:
          names.length,
      },

      error: null,
    };
  }


  async updateEntry(
    userId: string,
    tournamentId: string,
    registrationId: string,
    dto: UpdateTournamentEntryDto,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, leagueId: true, status: true, teamSize: true },
    });

    if (!tournament) throw this.tournamentNotFound();

    const entry = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        tournamentId: true,
        registeredByUserId: true,
        status: true,
        members: { select: { userId: true } },
      },
    });

    if (!entry || entry.tournamentId !== tournamentId) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: { code: 'TOURNAMENT_ENTRY_NOT_FOUND', message: 'Tournament team could not be found.' },
      });
    }

    const isCaptain = entry.registeredByUserId === userId;
    if (!isCaptain) {
      await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_PARTICIPANTS');
    } else if (!['PENDING', 'APPROVED'].includes(entry.status)) {
      throw new ConflictException({
        success: false,
        data: null,
        error: { code: 'ENTRY_STATUS_NOT_EDITABLE', message: 'This registration cannot be edited in its current status.' },
      });
    }

    await this.assertEntriesEditable(
      tournamentId,
      tournament.status,
    );

    const updated = await this.prisma.$transactionWithRetry(async (tx) => {
      let nextUserIds: string[] | undefined;

      if (dto.playerCodes !== undefined) {
        const playerCodes = [...new Set(dto.playerCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))];

        if (tournament.teamSize === 1) {
          throw new BadRequestException({
            success: false,
            data: null,
            error: { code: 'SOLO_ROSTER_LOCKED', message: 'Solo Tournament entries use the registered player automatically.' },
          });
        }

        if (playerCodes.length !== tournament.teamSize) {
          throw new BadRequestException({
            success: false,
            data: null,
            error: { code: 'INVALID_ENTRY_SIZE', message: `This Tournament requires exactly ${tournament.teamSize} Player IDs.` },
          });
        }

        const players = await tx.player.findMany({
          where: { playerCode: { in: playerCodes } },
          select: { playerCode: true, userId: true },
        });

        if (players.length !== playerCodes.length) {
          throw new BadRequestException({
            success: false,
            data: null,
            error: { code: 'PLAYER_NOT_FOUND', message: 'One or more FC ARENA Player IDs could not be found.' },
          });
        }

        nextUserIds = players.map((player) => player.userId);
        if (!nextUserIds.includes(entry.registeredByUserId)) {
          throw new ForbiddenException({
            success: false,
            data: null,
            error: { code: 'CAPTAIN_MUST_PARTICIPATE', message: 'The registering player must remain part of the team.' },
          });
        }

        const leagueMemberships = await tx.leagueMember.count({
          where: { leagueId: tournament.leagueId, userId: { in: nextUserIds } },
        });
        if (leagueMemberships !== nextUserIds.length) {
          throw new ForbiddenException({
            success: false,
            data: null,
            error: { code: 'PLAYER_NOT_IN_LEAGUE', message: 'Every team player must be a member of this League.' },
          });
        }

        const alreadyRegistered = await tx.tournamentRegistrationMember.findMany({
          where: {
            tournamentId,
            registrationId: { not: registrationId },
            userId: { in: nextUserIds },
          },
          select: { userId: true },
        });
        if (alreadyRegistered.length > 0) {
          throw new ConflictException({
            success: false,
            data: null,
            error: { code: 'PLAYER_ALREADY_REGISTERED', message: 'One or more players already belong to another entry in this Tournament.' },
          });
        }
      }

      if (dto.entryName !== undefined) {
        const name = dto.entryName.trim();
        if (!name) {
          throw new BadRequestException({
            success: false,
            data: null,
            error: {
              code: 'ENTRY_NAME_REQUIRED',
              message: 'Team name cannot be empty.',
            },
          });
        }
        await assertUniqueEntryName(tx, tournamentId, name, entry.id);
      }

      const updatedEntry = await tx.tournamentRegistration.update({
        where: {
          id:
            registrationId,
        },

        data: {
          entryName:
            dto.entryName ===
            undefined
              ? undefined
              : dto.entryName.trim(),

          entryLogoUrl:
            dto.entryLogoUrl ===
            undefined
              ? undefined
              : dto.entryLogoUrl.trim() ||
                null,
        },
      });

      if (nextUserIds) {
        await tx.tournamentRegistrationMember.deleteMany({ where: { registrationId } });
        await tx.tournamentRegistrationMember.createMany({
          data: nextUserIds.map((nextUserId) => ({ tournamentId, registrationId, userId: nextUserId })),
        });
      }

      return updatedEntry;
    }, { isolationLevel: 'Serializable' });

    return {
      success: true,

      data: {
        message:
          'Team updated successfully.',

        entry:
          updated,
      },

      error: null,
    };
  }


  async deleteEntry(
    userId: string,
    tournamentId: string,
    registrationId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    await this.assertEntriesEditable(
      tournamentId,
      tournament.status,
    );

    await this.getEntry(
      tournamentId,
      registrationId,
    );

    const fixtureCount =
      await this.prisma.fixture.count({
        where: {
          tournamentId,

          OR: [
            {
              homeRegistrationId:
                registrationId,
            },
            {
              awayRegistrationId:
                registrationId,
            },
          ],
        },
      });

    if (
      fixtureCount >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ENTRY_HAS_FIXTURES',

          message:
            `This team is used in ${fixtureCount} fixture(s). Reset or regenerate fixtures before deleting it.`,
        },
      });
    }

    await this.prisma.tournamentRegistration.delete({
      where: {
        id:
          registrationId,
      },
    });

    return {
      success: true,

      data: {
        message:
          'Team deleted successfully.',
      },

      error: null,
    };
  }


  async reorderEntries(
    userId: string,
    tournamentId: string,
    dto: ReorderTournamentEntriesDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    await this.assertEntriesEditable(
      tournamentId,
      tournament.status,
    );

    const existing =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,

          status: {
            in: [
              'APPROVED',
              'PENDING',
            ],
          },
        },

        select: {
          id: true,
        },
      });

    const actual =
      new Set(
        existing.map(
          (entry) =>
            entry.id,
        ),
      );

    const supplied =
      new Set(
        dto.registrationIds,
      );

    if (
      actual.size !==
        supplied.size ||
      [...actual].some(
        (id) =>
          !supplied.has(
            id,
          ),
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_ENTRY_ORDER',

          message:
            'Reorder request must include every current Tournament team exactly once.',
        },
      });
    }

    await this.prisma.$transaction(
      dto.registrationIds.map(
        (
          id,
          index,
        ) =>
          this.prisma.tournamentRegistration.update({
            where: {
              id,
            },

            data: {
              sortOrder:
                index,
            },
          }),
      ),
    );

    return {
      success: true,

      data: {
        message:
          'Team order updated.',
      },

      error: null,
    };
  }


  private async getEntry(
    tournamentId: string,
    registrationId: string,
  ) {
    const entry =
      await this.prisma.tournamentRegistration.findUnique({
        where: {
          id:
            registrationId,
        },
      });

    if (
      !entry ||
      entry.tournamentId !==
        tournamentId
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_ENTRY_NOT_FOUND',

          message:
            'Tournament team could not be found.',
        },
      });
    }

    return entry;
  }


  private async getTournamentForAdmin(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id:
            tournamentId,
        },

        select: {
          id: true,
          leagueId: true,
          status: true,
          maxEntries: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.authorization.assertCanManageTournamentPermission(userId, tournament.id, 'MANAGE_PARTICIPANTS');

    return tournament;
  }


  private async assertEntriesEditable(
    tournamentId: string,
    status: string,
  ) {
    if (
      ![
        'DRAFT',
        'REGISTRATION_OPEN',
        'REGISTRATION_CLOSED',
      ].includes(
        status,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_TEAMS_LOCKED',

          message:
            'Tournament participants are locked after the Tournament becomes active.',
        },
      });
    }

    const fixtureCount =
      await this.prisma.fixture.count({
        where: {
          tournamentId,
        },
      });

    if (
      fixtureCount >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_TEAMS_HAVE_FIXTURES',

          message:
            'Reset or remove generated fixtures before adding, editing, deleting or reordering Tournament participants.',
        },
      });
    }
  }


  private async assertLeagueMember(
    userId: string,
    leagueId: string,
  ) {
    const membership =
      await this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

    if (!membership) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'LEAGUE_MEMBERSHIP_REQUIRED',

          message:
            'You must be a League member to view Tournament teams.',
        },
      });
    }
  }



  private tournamentNotFound() {
    return new NotFoundException({
      success: false,
      data: null,

      error: {
        code:
          'TOURNAMENT_NOT_FOUND',

        message:
          'Tournament could not be found.',
      },
    });
  }
}
