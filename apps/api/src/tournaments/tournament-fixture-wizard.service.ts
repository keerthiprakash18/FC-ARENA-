import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomInt,
  randomUUID,
} from 'node:crypto';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  generateDoubleRoundRobinFixtures,
  generateKnockoutFixtures,
  generateRoundRobinFixtures,
  type FixtureBlueprint,
} from './fixture-engine.js';

import type {
  UpdateFixtureWizardSettingsDto,
} from './dto/update-fixture-wizard-settings.dto.js';


@Injectable()
export class TournamentFixtureWizardService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}


  async getSettings(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    return {
      success: true,

      data: {
        fixtureMode:
          tournament.fixtureMode,

        legType:
          tournament.legType,

        competitionFormat:
          tournament.competitionFormat,

        groupMode:
          tournament.groupMode,

        dailyMatchLimit:
          tournament.dailyMatchLimit,

        matchesPerParticipantPerDay:
          tournament.matchesPerParticipantPerDay,

        matchDurationMinutes:
          tournament.matchDurationMinutes,
      },

      error: null,
    };
  }


  async updateSettings(
    userId: string,
    tournamentId: string,
    dto: UpdateFixtureWizardSettingsDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    const updated =
      await this.prisma.tournament.update({
        where: {
          id:
            tournamentId,
        },

        data: {
          fixtureMode:
            dto.fixtureMode,

          legType:
            dto.legType,

          dailyMatchLimit:
            dto.dailyMatchLimit,

          matchesPerParticipantPerDay:
            dto.matchesPerParticipantPerDay,

          matchDurationMinutes:
            dto.matchDurationMinutes,

          wizardStep:
            'FIXTURE_PREVIEW',
        },
      });

    return {
      success: true,

      data: {
        message:
          'Fixture settings saved.',

        tournament:
          updated,

        nextStep:
          'FIXTURE_PREVIEW',
      },

      error: null,
    };
  }


  async generatePreview(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    const published =
      await this.prisma.fixture.count({
        where: {
          tournamentId,

          publishedAt: {
            not: null,
          },
        },
      });

    if (
      published >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'PUBLISHED_FIXTURES_LOCKED',

          message:
            'Published fixtures cannot be regenerated from the Tournament wizard.',
        },
      });
    }

    await this.prisma.fixture.deleteMany({
      where: {
        tournamentId,

        publishedAt:
          null,
      },
    });

    if (
      tournament.fixtureMode ===
      'MANUAL'
    ) {
      return {
        success: true,

        data: {
          message:
            'Manual fixture mode selected. Add fixtures from Fixture Preview.',

          fixtures:
            0,
        },

        error: null,
      };
    }

    const plans:
      Array<{
        groupId:
          string | null;

        groupName:
          string | null;

        registrationIds:
          string[];

        blueprints:
          FixtureBlueprint[];
      }> = [];


    if (
      tournament.groupMode ===
      'MULTIPLE_GROUPS'
    ) {
      const groups =
        await this.prisma.tournamentGroup.findMany({
          where: {
            tournamentId,
          },

          orderBy: {
            position:
              'asc',
          },

          include: {
            registrations: {
              where: {
                status:
                  'APPROVED',
              },

              orderBy: {
                sortOrder:
                  'asc',
              },

              select: {
                id: true,
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
              'GROUPS_NOT_READY',

            message:
              'Configure Tournament groups before generating fixtures.',
          },
        });
      }

      for (
        const group
        of groups
      ) {
        let ids =
          group.registrations.map(
            (
              registration,
            ) =>
              registration.id,
          );

        if (
          ids.length <
          2
        ) {
          throw new ConflictException({
            success: false,
            data: null,

            error: {
              code:
                'GROUP_NOT_READY',

              message:
                `${group.name} requires at least two teams.`,
            },
          });
        }

        if (
          tournament.fixtureMode ===
          'RANDOMIZED'
        ) {
          ids =
            this.shuffle(
              ids,
            );
        }

        plans.push({
          groupId:
            group.id,

          groupName:
            group.name,

          registrationIds:
            ids,

          blueprints:
            this.generateBlueprints(
              tournament.competitionFormat,
              tournament.legType,
              ids,
            ),
        });
      }
    } else {
      let ids =
        (
          await this.prisma.tournamentRegistration.findMany({
            where: {
              tournamentId,

              status:
                'APPROVED',
            },

            orderBy: {
              sortOrder:
                'asc',
            },

            select: {
              id: true,
            },
          })
        ).map(
          (
            registration,
          ) =>
            registration.id,
        );

      if (
        ids.length <
        2
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'NOT_ENOUGH_TEAMS',

            message:
              'At least two Tournament teams are required.',
          },
        });
      }

      if (
        tournament.fixtureMode ===
        'RANDOMIZED'
      ) {
        ids =
          this.shuffle(
            ids,
          );
      }

      plans.push({
        groupId:
          null,

        groupName:
          null,

        registrationIds:
          ids,

        blueprints:
          this.generateBlueprints(
            tournament.competitionFormat,
            tournament.legType,
            ids,
          ),
      });
    }


    let sequence =
      1;

    await this.prisma.$transaction(
      async (
        tx,
      ) => {
        for (
          const plan
          of plans
        ) {
          for (
            const blueprint
            of plan.blueprints
          ) {
            await tx.fixture.create({
              data: {
                fixtureCode:
                  this.fixtureCode(),

                tournamentId,

                groupId:
                  plan.groupId,

                sequence,

                matchday:
                  blueprint.matchday,

                roundNumber:
                  blueprint.roundNumber,

                roundName:
                  plan.groupName
                    ? `${plan.groupName} - ${blueprint.roundName}`
                    : blueprint.roundName,

                bracketPosition:
                  blueprint.bracketPosition,

                homeRegistrationId:
                  blueprint.homeRegistrationId,

                awayRegistrationId:
                  blueprint.awayRegistrationId,

                publishedAt:
                  null,
              },
            });

            sequence++;
          }
        }
      },
      {
        isolationLevel:
          'Serializable',
      },
    );


    return {
      success: true,

      data: {
        message:
          'Fixture preview generated successfully.',

        fixtures:
          sequence -
          1,
      },

      error: null,
    };
  }


  async getPreview(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    const fixtures =
      await this.prisma.fixture.findMany({
        where: {
          tournamentId,

          publishedAt:
            null,
        },

        orderBy: [
          {
            roundNumber:
              'asc',
          },
          {
            bracketPosition:
              'asc',
          },
        ],

        include: {
          group: {
            select: {
              id: true,
              name: true,
              position: true,
            },
          },

          homeRegistration: {
            select: {
              id: true,
              entryName: true,
              entryLogoUrl: true,
            },
          },

          awayRegistration: {
            select: {
              id: true,
              entryName: true,
              entryLogoUrl: true,
            },
          },
        },
      });

    return {
      success: true,

      data: {
        tournament: {
          id:
            tournament.id,

          name:
            tournament.name,

          competitionFormat:
            tournament.competitionFormat,

          fixtureMode:
            tournament.fixtureMode,
        },

        fixtures,
      },

      error: null,
    };
  }


  async resetPreview(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    const deleted =
      await this.prisma.fixture.deleteMany({
        where: {
          tournamentId,

          publishedAt:
            null,
        },
      });

    return {
      success: true,

      data: {
        message:
          'Fixture preview reset.',

        deleted:
          deleted.count,
      },

      error: null,
    };
  }


  private generateBlueprints(
    competitionFormat:
      string,

    legType:
      string,

    registrationIds:
      string[],
  ) {
    if (
      competitionFormat ===
      'SINGLE_ELIMINATION'
    ) {
      return generateKnockoutFixtures(
        registrationIds,
      );
    }

    if (
      competitionFormat ===
        'DOUBLE_ROUND_ROBIN' ||
      legType ===
        'HOME_AWAY'
    ) {
      return generateDoubleRoundRobinFixtures(
        registrationIds,
      );
    }

    return generateRoundRobinFixtures(
      registrationIds,
    );
  }


  private shuffle(
    source:
      string[],
  ) {
    const values = [
      ...source,
    ];

    for (
      let index =
        values.length -
        1;
      index >
      0;
      index--
    ) {
      const swap =
        randomInt(
          0,
          index +
            1,
        );

      [
        values[index],
        values[swap],
      ] = [
        values[swap],
        values[index],
      ];
    }

    return values;
  }


  private fixtureCode() {
    return `FCA-F-${randomUUID()
      .replaceAll(
        '-',
        '',
      )
      .slice(
        0,
        10,
      )
      .toUpperCase()}`;
  }


  private async getTournamentForAdmin(
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


  private assertDraft(
    status:
      string,
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
            'TOURNAMENT_WIZARD_LOCKED',

          message:
            'Tournament wizard fixtures can only be changed while the Tournament is Draft.',
        },
      });
    }
  }
}