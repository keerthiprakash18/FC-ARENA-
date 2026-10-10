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
  UpdateQualificationSettingsDto,
} from './dto/update-qualification-settings.dto.js';


@Injectable()
export class TournamentWizardFinalizeService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}


  async saveQualification(
    userId: string,
    tournamentId: string,
    dto: UpdateQualificationSettingsDto,
  ) {
    const tournament =
      await this.getAdminTournament(
        userId,
        tournamentId,
      );

    if (
      ![
        'GROUP_STAGE_KNOCKOUT',
        'SINGLE_ELIMINATION',
      ].includes(
        tournament.competitionFormat,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'PLAYOFF_SETUP_NOT_REQUIRED',
          message:
            'This Tournament format does not include a playoff stage.',
        },
      });
    }

    const [
      groups,
      approvedEntries,
    ] =
      await Promise.all([
        this.prisma.tournamentGroup.findMany({
          where: {
            tournamentId,
          },
          orderBy: {
            position:
              'asc',
          },
          include: {
            _count: {
              select: {
                registrations: {
                  where: {
                    status:
                      'APPROVED',
                  },
                },
              },
            },
          },
        }),

        this.prisma.tournamentRegistration.count({
          where: {
            tournamentId,
            status:
              'APPROVED',
          },
        }),
      ]);

    if (
      approvedEntries <
      2
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'NOT_ENOUGH_PLAYOFF_ENTRIES',
          message:
            'At least two approved entries are required before configuring playoffs.',
        },
      });
    }

    const resolvedSource =
      dto.playoffSource !==
      'AUTO'
        ? dto.playoffSource
        : tournament.competitionFormat ===
            'SINGLE_ELIMINATION'
          ? 'DIRECT_ENTRIES'
          : tournament.groupMode ===
                'MULTIPLE_GROUPS' &&
              groups.length >
                1
            ? 'GROUP_QUALIFIERS'
            : 'OVERALL_STANDINGS';

    let qualifiersPerGroup:
      number |
      null =
      null;

    let playoffQualifiersTotal:
      number |
      null =
      null;

    let totalQualifiers =
      approvedEntries;

    if (
      resolvedSource ===
      'GROUP_QUALIFIERS'
    ) {
      if (
        groups.length <
        2
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'GROUP_QUALIFIERS_REQUIRE_GROUPS',
            message:
              'Group Qualifiers requires at least two configured groups. Use Overall Standings for a single-group Tournament.',
          },
        });
      }

      qualifiersPerGroup =
        dto.qualifiersPerGroup ??
        tournament.qualifiersPerGroup ??
        1;

      if (
        !Number.isInteger(
          qualifiersPerGroup,
        ) ||
        qualifiersPerGroup <
          1
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'INVALID_QUALIFIER_COUNT',
            message:
              'Choose at least one qualifier per group.',
          },
        });
      }

      const tooSmall =
        groups.find(
          (
            group,
          ) =>
            group._count.registrations <
            qualifiersPerGroup!,
        );

      if (
        tooSmall
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'TOO_MANY_QUALIFIERS',
            message:
              `${tooSmall.name} contains only ${tooSmall._count.registrations} approved entries.`,
          },
        });
      }

      totalQualifiers =
        groups.length *
        qualifiersPerGroup;
    } else {
      playoffQualifiersTotal =
        dto.playoffQualifiersTotal ??
        tournament.playoffQualifiersTotal ??
        approvedEntries;

      if (
        !Number.isInteger(
          playoffQualifiersTotal,
        ) ||
        playoffQualifiersTotal <
          2 ||
        playoffQualifiersTotal >
          approvedEntries
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'INVALID_PLAYOFF_QUALIFIER_TOTAL',
            message:
              `Choose between 2 and ${approvedEntries} playoff entries.`,
          },
        });
      }

      totalQualifiers =
        playoffQualifiersTotal;
    }

    if (
      dto.playoffFormat ===
        'DOUBLE_CHANCE' &&
      totalQualifiers <
        3
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'DOUBLE_CHANCE_REQUIRES_THREE',
          message:
            'Elite Double-Chance requires at least three qualified entries.',
        },
      });
    }

    if (
      dto.playoffSeedingBasis ===
        'GROUP_POSITION' &&
      groups.length <
        2
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'GROUP_SEEDING_REQUIRES_GROUPS',
          message:
            'Group Position seeding requires multiple groups. Use Overall Performance or Manual seeding instead.',
        },
      });
    }

    const legacyPairingMethod =
      dto.playoffPairingMethod ??
      (
        dto.playoffSeedingBasis ===
          'RANDOM'
          ? 'RANDOM'
          : dto.playoffSeedingBasis ===
              'MANUAL'
            ? 'MANUAL'
            : resolvedSource ===
                  'GROUP_QUALIFIERS' &&
                dto.playoffFormat ===
                  'PROTECTED_SEED'
              ? 'CROSS_GROUP'
              : 'SEEDED'
      );

    const updated =
      await this.prisma.tournament.update({
        where: {
          id:
            tournamentId,
        },
        data: {
          qualifiersPerGroup,
          playoffQualifiersTotal,
          playoffPairingMethod:
            legacyPairingMethod,
          playoffFormat:
            dto.playoffFormat,
          playoffSource:
            dto.playoffSource,
          playoffSeedingBasis:
            dto.playoffSeedingBasis,
          avoidSameGroupEarly:
            dto.avoidSameGroupEarly ??
            true,
          wizardStep:
            'FIXTURE_SETTINGS',
        },
      });

    return {
      success: true,
      data: {
        message:
          'Playoff setup saved.',
        tournament:
          updated,
        totalQualifiers,
        resolvedSource,
        nextStep:
          'FIXTURE_SETTINGS',
      },
      error: null,
    };
  }

  async getReview(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getAdminTournament(
        userId,
        tournamentId,
      );

    const [
      approvedEntries,
      fixtureCount,
      groups,
      unassigned,
    ] =
      await Promise.all([
        this.prisma.tournamentRegistration.count({
          where: {
            tournamentId,

            status:
              'APPROVED',
          },
        }),

        this.prisma.fixture.count({
          where: {
            tournamentId,

            publishedAt: {
              not:
                null,
            },
          },
        }),

        this.prisma.tournamentGroup.findMany({
          where: {
            tournamentId,
          },

          orderBy: {
            position:
              'asc',
          },

          include: {
            _count: {
              select: {
                registrations: {
                  where: {
                    status:
                      'APPROVED',
                  },
                },
              },
            },
          },
        }),

        this.prisma.tournamentRegistration.count({
          where: {
            tournamentId,

            status:
              'APPROVED',

            groupId:
              null,
          },
        }),
      ]);

    return {
      success: true,

      data: {
        tournament: {
          id:
            tournament.id,

          name:
            tournament.name,

          code:
            tournament.code,

          mode:
            tournament.mode,

          competitionFormat:
            tournament.competitionFormat,

          groupMode:
            tournament.groupMode,

          legType:
            tournament.legType,

          fixtureMode:
            tournament.fixtureMode,

          visibility:
            tournament.visibility,

          registrationMode:
            tournament.registrationMode,

          maxEntries:
            tournament.maxEntries,

          qualifiersPerGroup:
            tournament.qualifiersPerGroup,

          playoffPairingMethod:
            tournament.playoffPairingMethod,

          playoffFormat:
            tournament.playoffFormat,

          playoffSource:
            tournament.playoffSource,

          playoffSeedingBasis:
            tournament.playoffSeedingBasis,

          playoffQualifiersTotal:
            tournament.playoffQualifiersTotal,

          avoidSameGroupEarly:
            tournament.avoidSameGroupEarly,

          status:
            tournament.status,
        },

        approvedEntries,

        fixtureCount,

        unassigned,

        groups:
          groups.map(
            (
              group,
            ) => ({
              id:
                group.id,

              name:
                group.name,

              teams:
                group
                  ._count
                  .registrations,
            }),
          ),
      },

      error: null,
    };
  }


  async publishTournament(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getAdminTournament(
        userId,
        tournamentId,
      );

    if (
      ![
        'DRAFT',
        'REGISTRATION_CLOSED',
      ].includes(
        tournament.status,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_ALREADY_PUBLISHED',

          message:
            'Tournament cannot be published from the current state.',
        },
      });
    }

    const approvedEntries =
      await this.prisma.tournamentRegistration.count({
        where: {
          tournamentId,

          status:
            'APPROVED',
        },
      });

    if (
      approvedEntries <
      2
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'NOT_ENOUGH_TEAMS',

          message:
            'At least two approved teams are required.',
        },
      });
    }

    const fixtureCount =
      await this.prisma.fixture.count({
        where: {
          tournamentId,

          publishedAt: {
            not:
              null,
          },
        },
      });

    if (
      fixtureCount ===
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'FIXTURES_NOT_PUBLISHED',

          message:
            'Publish the fixture preview before publishing the Tournament.',
        },
      });
    }

    if (
      tournament.groupMode ===
      'MULTIPLE_GROUPS'
    ) {
      const unassigned =
        await this.prisma.tournamentRegistration.count({
          where: {
            tournamentId,

            status:
              'APPROVED',

            groupId:
              null,
          },
        });

      if (
        unassigned >
        0
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'UNASSIGNED_TEAMS',

            message:
              `${unassigned} team(s) are still unassigned.`,
          },
        });
      }
    }

    if (
      [
        'GROUP_STAGE_KNOCKOUT',
        'SINGLE_ELIMINATION',
      ].includes(
        tournament.competitionFormat,
      )
    ) {
      const groups =
        await this.prisma.tournamentGroup.count({
          where: {
            tournamentId,
          },
        });

      const resolvedSource =
        tournament.playoffSource !==
        'AUTO'
          ? tournament.playoffSource
          : tournament.competitionFormat ===
              'SINGLE_ELIMINATION'
            ? 'DIRECT_ENTRIES'
            : tournament.groupMode ===
                  'MULTIPLE_GROUPS' &&
                groups >
                  1
              ? 'GROUP_QUALIFIERS'
              : 'OVERALL_STANDINGS';

      if (
        resolvedSource ===
          'GROUP_QUALIFIERS' &&
        !tournament.qualifiersPerGroup
      ) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code:
              'PLAYOFF_SETUP_NOT_CONFIGURED',
            message:
              'Configure qualifiers per group before publishing.',
          },
        });
      }

      if (
        resolvedSource !==
          'GROUP_QUALIFIERS' &&
        !tournament.playoffQualifiersTotal
      ) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code:
              'PLAYOFF_SETUP_NOT_CONFIGURED',
            message:
              'Configure the playoff qualifier total before publishing.',
          },
        });
      }
    }

    const now =
      new Date();

    const updated =
      await this.prisma.tournament.update({
        where: {
          id:
            tournamentId,
        },

        data: {
          status:
            'ACTIVE',

          publishedAt:
            now,

          wizardStep:
            'PUBLISHED',
        },
      });

    return {
      success: true,

      data: {
        message:
          'Tournament published successfully.',

        tournament:
          updated,
      },

      error: null,
    };
  }


  private async getAdminTournament(
    userId:
      string,

    tournamentId:
      string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id:
            tournamentId,
        },
      });

    if (!tournament) {
      throw new NotFoundException({
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

    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              tournament.leagueId,

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
            'League Admin permission is required.',
        },
      });
    }

    return tournament;
  }
}