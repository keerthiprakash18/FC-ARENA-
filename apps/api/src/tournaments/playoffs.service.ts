import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import { PrismaService } from '../database/prisma.service.js';

import type { GeneratePlayoffsDto } from './dto/generate-playoffs.dto.js';

import {
  generateKnockoutFixtures,
} from './fixture-engine.js';

import type {
  FixtureBlueprint,
} from './fixture-engine.js';


interface RankedQualifier {
  id: string;
  entryName: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
  wins: number;
}


@Injectable()
export class PlayoffsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}


  async generatePlayoffs(
    userId: string,
    tournamentId: string,
    dto: GeneratePlayoffsDto,
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
        },
      });


    if (!tournament) {
      throw this.tournamentNotFound();
    }


    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );


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
              status: 'APPROVED',
            },

            include: {
              standing: true,
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
            'GROUP_STAGE_REQUIRED',

          message:
            'At least two tournament groups are required before generating playoffs.',
        },
      });
    }


    if (
      groups.length % 2 !==
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'EVEN_GROUP_COUNT_REQUIRED',

          message:
            'Knockout cross-seeding currently requires an even number of groups.',
        },
      });
    }


    const groupFixtureCount =
      await this.prisma.fixture.count({
        where: {
          tournamentId,

          groupId: {
            not: null,
          },
        },
      });


    if (
      groupFixtureCount ===
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'GROUP_FIXTURES_REQUIRED',

          message:
            'Generate and complete the group-stage fixtures first.',
        },
      });
    }


    const incompleteFixtures =
      await this.prisma.fixture.count({
        where: {
          tournamentId,

          groupId: {
            not: null,
          },

          status: {
            not:
              'COMPLETED',
          },
        },
      });


    if (
      incompleteFixtures >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'GROUP_STAGE_NOT_COMPLETED',

          message:
            `${incompleteFixtures} group-stage fixture(s) are still incomplete.`,
        },
      });
    }


    const existingPlayoffs =
      await this.prisma.fixture.count({
        where: {
          tournamentId,
          groupId: null,
        },
      });


    if (
      existingPlayoffs >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'PLAYOFFS_ALREADY_GENERATED',

          message:
            'Knockout fixtures have already been generated.',
        },
      });
    }


    const qualifiersPerGroup =
      dto.qualifiersPerGroup;


    for (
      const group
      of groups
    ) {
      if (
        group.registrations
          .length <
        qualifiersPerGroup
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'NOT_ENOUGH_GROUP_ENTRIES',

            message:
              `${group.name} contains only ${group.registrations.length} approved entries but ${qualifiersPerGroup} qualifiers were requested.`,
          },
        });
      }
    }


    const totalQualifiers =
      groups.length *
      qualifiersPerGroup;


    if (
      !this.isPowerOfTwo(
        totalQualifiers,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_KNOCKOUT_SIZE',

          message:
            `Total qualifiers must form a standard knockout bracket (4, 8, 16, 32, 64...). Current total: ${totalQualifiers}.`,
        },
      });
    }


    const rankedGroups =
      groups.map(
        (group) => {
          const ranked =
            group.registrations
              .map(
                (
                  registration,
                ): RankedQualifier => ({
                  id:
                    registration.id,

                  entryName:
                    registration.entryName ??
                    'Tournament Entry',

                  points:
                    registration
                      .standing
                      ?.points ??
                    0,

                  goalDifference:
                    registration
                      .standing
                      ?.goalDifference ??
                    0,

                  goalsFor:
                    registration
                      .standing
                      ?.goalsFor ??
                    0,

                  wins:
                    registration
                      .standing
                      ?.wins ??
                    0,
                }),
              )
              .sort(
                (
                  a,
                  b,
                ) => {
                  if (
                    b.points !==
                    a.points
                  ) {
                    return (
                      b.points -
                      a.points
                    );
                  }

                  if (
                    b.goalDifference !==
                    a.goalDifference
                  ) {
                    return (
                      b.goalDifference -
                      a.goalDifference
                    );
                  }

                  if (
                    b.goalsFor !==
                    a.goalsFor
                  ) {
                    return (
                      b.goalsFor -
                      a.goalsFor
                    );
                  }

                  if (
                    b.wins !==
                    a.wins
                  ) {
                    return (
                      b.wins -
                      a.wins
                    );
                  }

                  return a.entryName.localeCompare(
                    b.entryName,
                  );
                },
              )
              .slice(
                0,
                qualifiersPerGroup,
              );


          return {
            id:
              group.id,

            name:
              group.name,

            position:
              group.position,

            qualifiers:
              ranked,
          };
        },
      );


    const seedOrder:
      string[] = [];


    for (
      let groupIndex = 0;
      groupIndex <
      rankedGroups.length;
      groupIndex += 2
    ) {
      const left =
        rankedGroups[
          groupIndex
        ];

      const right =
        rankedGroups[
          groupIndex + 1
        ];


      if (
        !left ||
        !right
      ) {
        throw new Error(
          'Invalid group pairing state.',
        );
      }


      if (
        qualifiersPerGroup ===
        1
      ) {
        seedOrder.push(
          left.qualifiers[0].id,
          right.qualifiers[0].id,
        );

        continue;
      }


      const half =
        qualifiersPerGroup /
        2;


      for (
        let rank = 0;
        rank < half;
        rank++
      ) {
        const reverseRank =
          qualifiersPerGroup -
          1 -
          rank;


        seedOrder.push(
          left.qualifiers[
            rank
          ].id,

          right.qualifiers[
            reverseRank
          ].id,

          right.qualifiers[
            rank
          ].id,

          left.qualifiers[
            reverseRank
          ].id,
        );
      }
    }


    if (
      seedOrder.length !==
      totalQualifiers
    ) {
      throw new Error(
        'Invalid playoff seed generation.',
      );
    }


    const uniqueSeeds =
      new Set(
        seedOrder,
      );


    if (
      uniqueSeeds.size !==
      seedOrder.length
    ) {
      throw new Error(
        'Duplicate playoff qualifier detected.',
      );
    }


    const blueprints =
      generateKnockoutFixtures(
        seedOrder,
      );


    const created =
      await this.prisma.$transaction(
        async (tx) => {
          const existing =
            await tx.fixture.count({
              where: {
                tournamentId,
                groupId: null,
              },
            });


          if (
            existing >
            0
          ) {
            throw new ConflictException({
              success: false,
              data: null,

              error: {
                code:
                  'PLAYOFFS_ALREADY_GENERATED',

                message:
                  'Knockout fixtures have already been generated.',
              },
            });
          }


          const latestFixture =
            await tx.fixture.findFirst({
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
            });


          let sequence =
            (latestFixture
              ?.sequence ??
              0) + 1;


          const fixtureIds =
            new Map<
              string,
              string
            >();


          for (
            const blueprint
            of blueprints
          ) {
            const fixture =
              await tx.fixture.create({
                data: {
                  fixtureCode:
                    this.createFixtureCode(),

                  tournamentId,

                  groupId:
                    null,

                  sequence,

                  matchday:
                    null,

                  roundNumber:
                    blueprint.roundNumber,

                  roundName:
                    blueprint.roundName,

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


            fixtureIds.set(
              blueprint.key,
              fixture.id,
            );


            await this.connectPreviousFixtures(
              tx,
              blueprint,
              fixture.id,
              fixtureIds,
            );


            sequence++;
          }


          return (
            sequence -
            ((latestFixture
              ?.sequence ??
              0) + 1)
          );
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
          'Knockout stage generated successfully.',

        qualifiersPerGroup,

        totalQualifiers,

        fixtures:
          created,

        groups:
          rankedGroups.map(
            (group) => ({
              id:
                group.id,

              name:
                group.name,

              qualifiers:
                group.qualifiers.map(
                  (
                    entry,
                    index,
                  ) => ({
                    position:
                      index + 1,

                    registrationId:
                      entry.id,

                    entryName:
                      entry.entryName,

                    points:
                      entry.points,

                    goalDifference:
                      entry.goalDifference,

                    goalsFor:
                      entry.goalsFor,
                  }),
                ),
            }),
          ),
      },

      error: null,
    };
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


  private async connectPreviousFixtures(
    tx: any,
    blueprint:
      FixtureBlueprint,
    fixtureId: string,
    fixtureIds:
      Map<string, string>,
  ) {
    if (
      blueprint.homeSourceKey
    ) {
      const sourceId =
        fixtureIds.get(
          blueprint.homeSourceKey,
        );


      if (!sourceId) {
        throw new Error(
          `Missing source fixture: ${blueprint.homeSourceKey}`,
        );
      }


      await tx.fixture.update({
        where: {
          id:
            sourceId,
        },

        data: {
          nextFixtureId:
            fixtureId,

          nextSlot:
            'HOME',
        },
      });
    }


    if (
      blueprint.awaySourceKey
    ) {
      const sourceId =
        fixtureIds.get(
          blueprint.awaySourceKey,
        );


      if (!sourceId) {
        throw new Error(
          `Missing source fixture: ${blueprint.awaySourceKey}`,
        );
      }


      await tx.fixture.update({
        where: {
          id:
            sourceId,
        },

        data: {
          nextFixtureId:
            fixtureId,

          nextSlot:
            'AWAY',
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
            'League Admin permission is required.',
        },
      });
    }
  }


  private isPowerOfTwo(
    value: number,
  ) {
    return (
      value >= 2 &&
      (value &
        (value - 1)) ===
        0
    );
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
}