import {
  BadRequestException,
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

import type {
  GenerateFixturePreviewDto,
} from './dto/generate-fixture-preview.dto.js';

import type {
  UpdateFixtureWizardSettingsDto,
} from './dto/update-fixture-wizard-settings.dto.js';

import {
  generateDoubleRoundRobinFixtures,
  generateKnockoutFixtures,
  generateRoundRobinFixtures,
  type FixtureBlueprint,
} from './fixture-engine.js';


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
    dto:
      GenerateFixturePreviewDto = {},
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    if (
      dto.groupId &&
      tournament.groupMode !==
        'MULTIPLE_GROUPS'
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'GROUP_SCOPE_NOT_AVAILABLE',

          message:
            'Specific Group generation is only available for Multiple Group tournaments.',
        },
      });
    }

    if (
      dto.groupId
    ) {
      await this.assertGroupBelongsToTournament(
        tournamentId,
        dto.groupId,
      );
    }

    const published =
      await this.prisma.fixture.count({
        where: {
          tournamentId,

          ...(dto.groupId
            ? {
                groupId:
                  dto.groupId,
              }
            : {}),

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
            dto.groupId
              ? 'This Group already contains published fixtures. Existing official fixtures cannot be regenerated.'
              : 'Published fixtures cannot be regenerated from the Tournament wizard.',
        },
      });
    }

    await this.prisma.fixture.deleteMany({
      where: {
        tournamentId,

        ...(dto.groupId
          ? {
              groupId:
                dto.groupId,
            }
          : {}),

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
            'Manual fixture mode selected. Add matches from Fixture Preview.',

          fixtures:
            0,
        },

        error: null,
      };
    }

    const selectedIds =
      dto.registrationIds
        ? await this.validateSelectedRegistrations(
            tournamentId,
            dto.registrationIds,
            dto.groupId,
          )
        : null;

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
      dto.groupId
    ) {
      const group =
        await this.prisma.tournamentGroup.findUniqueOrThrow({
          where: {
            id:
              dto.groupId,
          },

          select: {
            id: true,
            name: true,
          },
        });

      const ids =
        selectedIds ??
        await this.getApprovedRegistrationIds(
          tournamentId,
          group.id,
        );

      this.assertEnoughParticipants(
        ids,
        group.name,
      );

      plans.push({
        groupId:
          group.id,

        groupName:
          group.name,

        registrationIds:
          this.maybeShuffle(
            ids,
            tournament.fixtureMode,
          ),

        blueprints:
          [],
      });
    } else if (
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

                ...(selectedIds
                  ? {
                      id: {
                        in:
                          selectedIds,
                      },
                    }
                  : {}),
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

      if (
        selectedIds
      ) {
        const assigned =
          new Set(
            groups.flatMap(
              (
                group,
              ) =>
                group.registrations.map(
                  (
                    registration,
                  ) =>
                    registration.id,
                ),
            ),
          );

        const unassignedSelection =
          selectedIds.filter(
            (
              id,
            ) =>
              !assigned.has(
                id,
              ),
          );

        if (
          unassignedSelection.length >
          0
        ) {
          throw new BadRequestException({
            success: false,
            data: null,

            error: {
              code:
                'SELECTED_PARTICIPANTS_NOT_GROUPED',

              message:
                'Every selected participant must be assigned to a Tournament Group before Whole Tournament group-stage generation.',
            },
          });
        }
      }

      for (
        const group
        of groups
      ) {
        const ids =
          group.registrations.map(
            (
              registration,
            ) =>
              registration.id,
          );

        if (
          selectedIds &&
          ids.length ===
          0
        ) {
          continue;
        }

        this.assertEnoughParticipants(
          ids,
          group.name,
        );

        plans.push({
          groupId:
            group.id,

          groupName:
            group.name,

          registrationIds:
            this.maybeShuffle(
              ids,
              tournament.fixtureMode,
            ),

          blueprints:
            [],
        });
      }
    } else {
      const ids =
        selectedIds ??
        await this.getApprovedRegistrationIds(
          tournamentId,
        );

      this.assertEnoughParticipants(
        ids,
        'Tournament',
      );

      plans.push({
        groupId:
          null,

        groupName:
          null,

        registrationIds:
          this.maybeShuffle(
            ids,
            tournament.fixtureMode,
          ),

        blueprints:
          [],
      });
    }


    if (
      plans.length ===
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'NO_FIXTURE_SCOPE',

          message:
            'No valid participants are available for this fixture scope.',
        },
      });
    }

    const matchdayPrefix =
      dto.matchdayPrefix
        ?.trim() ||
      'Matchday';

    for (
      const plan
      of plans
    ) {
      const generated =
        this.generateBlueprints(
          tournament.competitionFormat,
          tournament.legType,
          plan.registrationIds,
        );

      plan.blueprints =
        this.applyHomeAwayMode(
          generated,
          tournament.legType,
          dto.homeAwayMode ??
            'BALANCED',
        );
    }


    let sequence =
      (
        await this.prisma.fixture.findFirst({
          where: {
            tournamentId,
          },

          orderBy: {
            sequence:
              'desc',
          },

          select: {
            sequence: true,
          },
        })
      )?.sequence ??
      0;

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
            sequence++;

            const scheduledAt =
              this.buildScheduledAt(
                dto,
                blueprint.roundNumber,
              );

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
                    ? `${plan.groupName} - ${matchdayPrefix} ${blueprint.roundNumber}`
                    : `${matchdayPrefix} ${blueprint.roundNumber}`,

                bracketPosition:
                  blueprint.bracketPosition,

                homeRegistrationId:
                  blueprint.homeRegistrationId,

                awayRegistrationId:
                  blueprint.awayRegistrationId,

                scheduledAt,

                publishedAt:
                  null,
              },
            });
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
          plans.reduce(
            (
              total,
              plan,
            ) =>
              total +
              plan.blueprints.length,
            0,
          ),

        groups:
          plans.map(
            (
              plan,
            ) => ({
              groupId:
                plan.groupId,

              groupName:
                plan.groupName,

              participants:
                plan.registrationIds.length,

              fixtures:
                plan.blueprints.length,
            }),
          ),
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

          legType:
            tournament.legType,

          groupMode:
            tournament.groupMode,
        },

        fixtures,
      },

      error: null,
    };
  }


  async resetPreview(
    userId: string,
    tournamentId: string,
    groupId?: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    if (
      groupId
    ) {
      await this.assertGroupBelongsToTournament(
        tournamentId,
        groupId,
      );
    }

    const deleted =
      await this.prisma.fixture.deleteMany({
        where: {
          tournamentId,

          ...(groupId
            ? {
                groupId,
              }
            : {}),

          publishedAt:
            null,
        },
      });

    return {
      success: true,

      data: {
        message:
          groupId
            ? 'Group fixture preview reset.'
            : 'Fixture preview reset.',

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


  private applyHomeAwayMode(
    source:
      FixtureBlueprint[],

    legType:
      string,

    mode:
      | 'BALANCED'
      | 'RANDOM'
      | 'MANUAL',
  ) {
    const fixtures =
      source.map(
        (
          fixture,
        ) => ({
          ...fixture,
        }),
      );

    if (
      mode !==
      'RANDOM'
    ) {
      return fixtures;
    }

    if (
      legType ===
      'HOME_AWAY'
    ) {
      const pairs =
        new Map<
          string,
          FixtureBlueprint[]
        >();

      for (
        const fixture
        of fixtures
      ) {
        const home =
          fixture.homeRegistrationId;

        const away =
          fixture.awayRegistrationId;

        if (
          !home ||
          !away
        ) {
          continue;
        }

        const key =
          [
            home,
            away,
          ]
            .sort()
            .join(':');

        const list =
          pairs.get(
            key,
          ) ??
          [];

        list.push(
          fixture,
        );

        pairs.set(
          key,
          list,
        );
      }

      for (
        const pair
        of pairs.values()
      ) {
        if (
          randomInt(
            0,
            2,
          ) ===
          0
        ) {
          continue;
        }

        for (
          const fixture
          of pair
        ) {
          [
            fixture.homeRegistrationId,
            fixture.awayRegistrationId,
          ] = [
            fixture.awayRegistrationId,
            fixture.homeRegistrationId,
          ];
        }
      }

      return fixtures;
    }

    for (
      const fixture
      of fixtures
    ) {
      if (
        randomInt(
          0,
          2,
        ) ===
        1
      ) {
        [
          fixture.homeRegistrationId,
          fixture.awayRegistrationId,
        ] = [
          fixture.awayRegistrationId,
          fixture.homeRegistrationId,
        ];
      }
    }

    return fixtures;
  }


  private maybeShuffle(
    ids:
      string[],

    fixtureMode:
      string,
  ) {
    if (
      fixtureMode !==
      'RANDOMIZED'
    ) {
      return [
        ...ids,
      ];
    }

    return this.shuffle(
      ids,
    );
  }


  private async validateSelectedRegistrations(
    tournamentId:
      string,

    registrationIds:
      string[],

    groupId?:
      string,
  ) {
    const registrations =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,

          id: {
            in:
              registrationIds,
          },

          status:
            'APPROVED',
        },

        select: {
          id: true,
          groupId: true,
        },
      });

    if (
      registrations.length !==
      registrationIds.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_FIXTURE_PARTICIPANTS',

          message:
            'Every selected participant must be an approved entry in this Tournament.',
        },
      });
    }

    if (
      groupId &&
      registrations.some(
        (
          registration,
        ) =>
          registration.groupId !==
          groupId,
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'CROSS_GROUP_SELECTION',

          message:
            'Every selected participant must belong to the selected Group.',
        },
      });
    }

    return [
      ...registrationIds,
    ];
  }


  private async getApprovedRegistrationIds(
    tournamentId:
      string,

    groupId?:
      string,
  ) {
    return (
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,

          status:
            'APPROVED',

          ...(groupId
            ? {
                groupId,
              }
            : {}),
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
  }


  private assertEnoughParticipants(
    ids:
      string[],

    scopeName:
      string,
  ) {
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
            `${scopeName} requires at least two participants.`,
        },
      });
    }
  }


  private buildScheduledAt(
    dto:
      GenerateFixturePreviewDto,

    roundNumber:
      number,
  ) {
    if (
      !dto.startDate
    ) {
      return null;
    }

    const value =
      new Date(
        dto.startDate,
      );

    const interval =
      dto.matchdayIntervalDays ??
      0;

    value.setUTCDate(
      value.getUTCDate() +
      (
        roundNumber -
        1
      ) *
      interval,
    );

    if (
      dto.defaultMatchTime
    ) {
      const [
        hour,
        minute,
      ] =
        dto.defaultMatchTime
          .split(':')
          .map(
            Number,
          );

      value.setUTCHours(
        hour,
        minute,
        0,
        0,
      );
    }

    return value;
  }


  private async assertGroupBelongsToTournament(
    tournamentId:
      string,

    groupId:
      string,
  ) {
    const group =
      await this.prisma.tournamentGroup.findUnique({
        where: {
          id:
            groupId,
        },

        select: {
          tournamentId: true,
        },
      });

    if (
      !group ||
      group.tournamentId !==
      tournamentId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_FIXTURE_GROUP',

          message:
            'Selected Group does not belong to this Tournament.',
        },
      });
    }
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
