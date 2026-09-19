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
      tournament.competitionFormat !==
      'GROUP_STAGE_KNOCKOUT'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'QUALIFICATION_NOT_REQUIRED',

          message:
            'Qualification settings only apply to Group Stage + Knockout tournaments.',
        },
      });
    }

    const groups =
      await this.prisma.tournamentGroup.findMany({
        where: {
          tournamentId,
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
      });

    if (
      groups.length <
      2
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'GROUPS_REQUIRED',

          message:
            'Configure at least two groups first.',
        },
      });
    }

    if (
      groups.some(
        (
          group,
        ) =>
          group._count.registrations <
          dto.qualifiersPerGroup,
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'TOO_MANY_QUALIFIERS',

          message:
            'Qualifiers per group cannot exceed the number of teams in a group.',
        },
      });
    }

    const total =
      groups.length *
      dto.qualifiersPerGroup;

    if (
      total <
      2
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_QUALIFIER_COUNT',

          message:
            'At least two teams must qualify for the knockout stage.',
        },
      });
    }

    const updated =
      await this.prisma.tournament.update({
        where: {
          id:
            tournamentId,
        },

        data: {
          qualifiersPerGroup:
            dto.qualifiersPerGroup,

          playoffPairingMethod:
            dto.playoffPairingMethod,

          wizardStep:
            'REVIEW',
        },
      });

    return {
      success: true,

      data: {
        message:
          'Qualification settings saved.',

        tournament:
          updated,

        totalQualifiers:
          total,

        nextStep:
          'REVIEW',
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
      tournament.status !==
      'DRAFT'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_ALREADY_PUBLISHED',

          message:
            'Tournament is no longer in Draft.',
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
      tournament.competitionFormat ===
        'GROUP_STAGE_KNOCKOUT' &&
      !tournament.qualifiersPerGroup
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'QUALIFICATION_NOT_CONFIGURED',

          message:
            'Configure qualification rules before publishing.',
        },
      });
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