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


@Injectable()
export class TournamentEntriesService {
  constructor(
    private readonly prisma:
      PrismaService,
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

          _count: {
            select: {
              homeFixtures: true,
              awayFixtures: true,
            },
          },
        },
      });

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
                entry._count.homeFixtures +
                entry._count.awayFixtures,

              _count:
                undefined,
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

    this.assertDraft(
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

    await this.assertUniqueEntryName(
      tournamentId,
      entryName,
    );

    const currentCount =
      await this.prisma.tournamentRegistration.count({
        where: {
          tournamentId,

          status: {
            in: [
              'APPROVED',
              'PENDING',
            ],
          },
        },
      });

    if (
      currentCount >=
      tournament.maxEntries
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_ENTRY_LIMIT_REACHED',

          message:
            `This Tournament allows a maximum of ${tournament.maxEntries} entries.`,
        },
      });
    }

    const latest =
      await this.prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId,
        },

        orderBy: {
          sortOrder:
            'desc',
        },

        select: {
          sortOrder: true,
        },
      });

    const entry =
      await this.prisma.tournamentRegistration.create({
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

    this.assertDraft(
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
          name.toLocaleLowerCase(),
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
          entryName: true,
        },
      });

    const existingNames =
      new Set(
        existing
          .map(
            (entry) =>
              entry.entryName
                ?.trim()
                .toLocaleLowerCase(),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
      );

    const duplicate =
      names.find(
        (name) =>
          existingNames.has(
            name.toLocaleLowerCase(),
          ),
      );

    if (duplicate) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ENTRY_NAME_ALREADY_EXISTS',

          message:
            `${duplicate} already exists in this Tournament.`,
        },
      });
    }

    if (
      existing.length +
        names.length >
      tournament.maxEntries
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_ENTRY_LIMIT_REACHED',

          message:
            `Only ${Math.max(
              0,
              tournament.maxEntries -
                existing.length,
            )} more team(s) can be added.`,
        },
      });
    }

    const latest =
      await this.prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId,
        },

        orderBy: {
          sortOrder:
            'desc',
        },

        select: {
          sortOrder: true,
        },
      });

    const startOrder =
      (latest?.sortOrder ??
        -1) + 1;

    await this.prisma.$transaction(
      names.map(
        (
          entryName,
          index,
        ) =>
          this.prisma.tournamentRegistration.create({
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
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    const entry =
      await this.getEntry(
        tournamentId,
        registrationId,
      );

    if (
      dto.entryName !==
      undefined
    ) {
      const name =
        dto.entryName.trim();

      if (!name) {
        throw new BadRequestException({
          success: false,
          data: null,

          error: {
            code:
              'ENTRY_NAME_REQUIRED',

            message:
              'Team name cannot be empty.',
          },
        });
      }

      await this.assertUniqueEntryName(
        tournamentId,
        name,
        entry.id,
      );
    }

    const updated =
      await this.prisma.tournamentRegistration.update({
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

    this.assertDraft(
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

    this.assertDraft(
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


  private async assertUniqueEntryName(
    tournamentId: string,
    entryName: string,
    ignoreRegistrationId?: string,
  ) {
    const existing =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,

          ...(ignoreRegistrationId
            ? {
                id: {
                  not:
                    ignoreRegistrationId,
                },
              }
            : {}),
        },

        select: {
          entryName: true,
        },
      });

    const normalized =
      entryName
        .trim()
        .toLocaleLowerCase();

    if (
      existing.some(
        (entry) =>
          entry.entryName
            ?.trim()
            .toLocaleLowerCase() ===
          normalized,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ENTRY_NAME_ALREADY_EXISTS',

          message:
            'A team with this name already exists in this Tournament.',
        },
      });
    }
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

    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );

    return tournament;
  }


  private assertDraft(
    status: string,
  ) {
    if (
      status !==
      'DRAFT'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_TEAMS_LOCKED',

          message:
            'Tournament teams can only be edited while the Tournament is in Draft.',
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


  private async assertLeagueAdmin(
    userId: string,
    leagueId: string,
  ) {
    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

    if (!admin) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'LEAGUE_ADMIN_REQUIRED',

          message:
            'League Admin permission is required to manage Tournament teams.',
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