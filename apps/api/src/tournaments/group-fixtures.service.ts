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

import { PrismaService } from '../database/prisma.service.js';

import {
  generateRoundRobinFixtures,
} from './fixture-engine.js';

@Injectable()
export class GroupFixturesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async generateGroupFixtures(
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
          status: true,
          fixturesGeneratedAt: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );

    if (
      tournament.status !==
      'REGISTRATION_CLOSED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'REGISTRATION_MUST_BE_CLOSED',

          message:
            'Close tournament registration before generating group fixtures.',
        },
      });
    }

    const existingFixtures =
      await this.prisma.fixture.count({
        where: {
          tournamentId,
        },
      });

    if (existingFixtures > 0) {
      throw this.fixturesAlreadyGenerated();
    }

    const approvedEntries =
      await this.prisma.tournamentRegistration.count({
        where: {
          tournamentId,
          status: 'APPROVED',
        },
      });

    if (approvedEntries < 2) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'NOT_ENOUGH_PARTICIPANTS',

          message:
            'At least two approved entries are required.',
        },
      });
    }

    const groups =
      await this.prisma.tournamentGroup.findMany({
        where: {
          tournamentId,
        },

        orderBy: {
          position: 'asc',
        },

        include: {
          registrations: {
            where: {
              status:
                'APPROVED',
            },

            orderBy: [
              {
                reviewedAt:
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
          },
        },
      });

    if (groups.length < 2) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'GROUPS_REQUIRED',

          message:
            'Create at least two tournament groups before generating fixtures.',
        },
      });
    }

    const assignedEntries =
      groups.reduce(
        (
          total,
          group,
        ) =>
          total +
          group.registrations.length,
        0,
      );

    if (
      assignedEntries !==
      approvedEntries
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'UNASSIGNED_ENTRIES',

          message:
            'Every approved entry must be assigned to a group before generating fixtures.',
        },
      });
    }

    for (
      const group of groups
    ) {
      if (
        group.registrations
          .length < 2
      ) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code:
              'GROUP_NOT_PLAYABLE',

            message:
              `${group.name} must contain at least two entries.`,
          },
        });
      }
    }

    const plans =
      groups.map(
        (group) => {
          const registrationIds =
            this.shuffle(
              group.registrations.map(
                (
                  registration,
                ) =>
                  registration.id,
              ),
            );

          const blueprints =
            generateRoundRobinFixtures(
              registrationIds,
            );

          return {
            group,
            registrationIds,
            blueprints,
          };
        },
      );

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const fixtureCount =
            await tx.fixture.count({
              where: {
                tournamentId,
              },
            });

          if (
            fixtureCount > 0
          ) {
            throw this.fixturesAlreadyGenerated();
          }

          let sequence = 1;

          const summaries: Array<{
            id: string;
            name: string;
            entries: number;
            fixtures: number;
            matchesPerEntry: number;
          }> = [];

          for (
            const plan of plans
          ) {
            for (
              const blueprint
              of plan.blueprints
            ) {
              const fixture =
                await tx.fixture.create({
                  data: {
                    fixtureCode:
                      this.createFixtureCode(),

                    tournamentId,

                    groupId:
                      plan.group.id,

                    sequence,

                    matchday:
                      blueprint.matchday,

                    roundNumber:
                      blueprint.roundNumber,

                    roundName:
                      `${plan.group.name} - ${blueprint.roundName}`,

                    bracketPosition:
                      blueprint.bracketPosition,

                    homeRegistrationId:
                      blueprint.homeRegistrationId,

                    awayRegistrationId:
                      blueprint.awayRegistrationId,
                  },
                });

              await this.createMatchForFixture(
                tx,
                tournamentId,
                fixture.id,
              );

              sequence++;
            }

            summaries.push({
              id:
                plan.group.id,

              name:
                plan.group.name,

              entries:
                plan.registrationIds.length,

              fixtures:
                plan.blueprints.length,

              matchesPerEntry:
                plan.registrationIds.length -
                1,
            });
          }

          await tx.tournament.update({
            where: {
              id:
                tournamentId,
            },

            data: {
              fixturesGeneratedAt:
                new Date(),
            },
          });

          return {
            totalFixtures:
              sequence - 1,

            groups:
              summaries,
          };
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
          'Group-stage fixtures generated successfully.',

        participants:
          approvedEntries,

        fixtures:
          result.totalFixtures,

        groups:
          result.groups,
      },

      error: null,
    };
  }

  private shuffle(
    values: string[],
  ) {
    const result = [
      ...values,
    ];

    for (
      let index =
        result.length - 1;
      index > 0;
      index--
    ) {
      const swapIndex =
        randomInt(
          0,
          index + 1,
        );

      [
        result[index],
        result[swapIndex],
      ] = [
        result[swapIndex],
        result[index],
      ];
    }

    return result;
  }

  private async createMatchForFixture(
    client: any,
    tournamentId: string,
    fixtureId: string,
  ) {
    const match =
      await client.match.create({
        data: {
          tournamentId,
          fixtureId,
        },
      });

    const matchCode =
      `FCA-M-${String(
        match.serialNumber,
      ).padStart(
        6,
        '0',
      )}`;

    return client.match.update({
      where: {
        id:
          match.id,
      },

      data: {
        matchCode,
      },
    });
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
            'League Admin permission is required to generate group fixtures.',
        },
      });
    }
  }

  private createFixtureCode() {
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

  private fixturesAlreadyGenerated() {
    return new ConflictException({
      success: false,
      data: null,
      error: {
        code:
          'FIXTURES_ALREADY_GENERATED',

        message:
          'Fixtures have already been generated for this tournament.',
      },
    });
  }
}