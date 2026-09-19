import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import {
  PrismaService,
} from '../database/prisma.service.js';

import type {
  CreatePreviewFixtureDto,
} from './dto/create-preview-fixture.dto.js';

import type {
  UpdatePreviewFixtureDto,
} from './dto/update-preview-fixture.dto.js';


@Injectable()
export class TournamentFixturePreviewService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}


  async createFixture(
    userId: string,
    tournamentId: string,
    dto: CreatePreviewFixtureDto,
  ) {
    const tournament =
      await this.getAdminTournament(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    await this.validateParticipants(
      tournamentId,
      dto.homeRegistrationId,
      dto.awayRegistrationId,
      dto.groupId,
    );

    await this.assertNoDuplicate(
      tournamentId,
      dto.homeRegistrationId,
      dto.awayRegistrationId,
    );

    const latest =
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
      });

    const fixture =
      await this.prisma.fixture.create({
        data: {
          fixtureCode:
            this.fixtureCode(),

          tournamentId,

          groupId:
            dto.groupId ??
            null,

          sequence:
            (latest?.sequence ??
              0) + 1,

          matchday:
            dto.matchday ??
            dto.roundNumber,

          roundNumber:
            dto.roundNumber,

          roundName:
            `MATCHDAY ${dto.roundNumber}`,

          bracketPosition:
            1,

          homeRegistrationId:
            dto.homeRegistrationId,

          awayRegistrationId:
            dto.awayRegistrationId,

          scheduledAt:
            dto.scheduledAt
              ? new Date(
                  dto.scheduledAt,
                )
              : null,

          venue:
            dto.venue?.trim() ||
            null,

          publishedAt:
            null,
        },
      });

    return {
      success: true,

      data: {
        message:
          'Fixture added to preview.',

        fixture,
      },

      error: null,
    };
  }


  async updateFixture(
    userId: string,
    tournamentId: string,
    fixtureId: string,
    dto: UpdatePreviewFixtureDto,
  ) {
    const tournament =
      await this.getAdminTournament(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    const fixture =
      await this.getDraftFixture(
        tournamentId,
        fixtureId,
      );

    const homeId =
      dto.homeRegistrationId ??
      fixture.homeRegistrationId;

    const awayId =
      dto.awayRegistrationId ??
      fixture.awayRegistrationId;

    if (
      !homeId ||
      !awayId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'FIXTURE_PARTICIPANTS_REQUIRED',

          message:
            'Home and Away teams are required.',
        },
      });
    }

    await this.validateParticipants(
      tournamentId,
      homeId,
      awayId,
      dto.groupId ??
        fixture.groupId ??
        undefined,
    );

    await this.assertNoDuplicate(
      tournamentId,
      homeId,
      awayId,
      fixture.id,
    );

    const roundNumber =
      dto.roundNumber ??
      fixture.roundNumber;

    const updated =
      await this.prisma.fixture.update({
        where: {
          id:
            fixture.id,
        },

        data: {
          homeRegistrationId:
            homeId,

          awayRegistrationId:
            awayId,

          groupId:
            dto.groupId,

          roundNumber:
            dto.roundNumber,

          matchday:
            dto.matchday,

          roundName:
            dto.roundNumber
              ? `MATCHDAY ${roundNumber}`
              : undefined,

          scheduledAt:
            dto.scheduledAt
              ? new Date(
                  dto.scheduledAt,
                )
              : undefined,

          venue:
            dto.venue ===
            undefined
              ? undefined
              : dto.venue.trim() ||
                null,
        },
      });

    return {
      success: true,

      data: {
        message:
          'Fixture updated.',

        fixture:
          updated,
      },

      error: null,
    };
  }


  async swapHomeAway(
    userId: string,
    tournamentId: string,
    fixtureId: string,
  ) {
    const tournament =
      await this.getAdminTournament(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    const fixture =
      await this.getDraftFixture(
        tournamentId,
        fixtureId,
      );

    if (
      !fixture.homeRegistrationId ||
      !fixture.awayRegistrationId
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'FIXTURE_PARTICIPANTS_REQUIRED',

          message:
            'Cannot swap an incomplete fixture.',
        },
      });
    }

    const updated =
      await this.prisma.fixture.update({
        where: {
          id:
            fixture.id,
        },

        data: {
          homeRegistrationId:
            fixture.awayRegistrationId,

          awayRegistrationId:
            fixture.homeRegistrationId,
        },
      });

    return {
      success: true,

      data: {
        message:
          'Home and Away swapped.',

        fixture:
          updated,
      },

      error: null,
    };
  }


  async deleteFixture(
    userId: string,
    tournamentId: string,
    fixtureId: string,
  ) {
    const tournament =
      await this.getAdminTournament(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    const fixture =
      await this.getDraftFixture(
        tournamentId,
        fixtureId,
      );

    await this.prisma.fixture.delete({
      where: {
        id:
          fixture.id,
      },
    });

    return {
      success: true,

      data: {
        message:
          'Fixture removed from preview.',
      },

      error: null,
    };
  }


  async publishFixtures(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getAdminTournament(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
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
      });

    if (
      fixtures.length ===
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'NO_FIXTURES_TO_PUBLISH',

          message:
            'Generate or manually add fixtures before continuing.',
        },
      });
    }

    this.validateFixtureSet(
      fixtures,
      tournament.legType,
      tournament.competitionFormat,
    );

    const publishedAt =
      new Date();

    await this.prisma.$transaction(
      async (
        tx,
      ) => {
        for (
          const fixture
          of fixtures
        ) {
          const existingMatch =
            await tx.match.findUnique({
              where: {
                fixtureId:
                  fixture.id,
              },
            });

          if (
            !existingMatch
          ) {
            const match =
              await tx.match.create({
                data: {
                  tournamentId,
                  fixtureId:
                    fixture.id,
                },
              });

            await tx.match.update({
              where: {
                id:
                  match.id,
              },

              data: {
                matchCode:
                  `FCA-M-${String(
                    match.serialNumber,
                  ).padStart(
                    6,
                    '0',
                  )}`,
              },
            });
          }

          await tx.fixture.update({
            where: {
              id:
                fixture.id,
            },

            data: {
              publishedAt,
            },
          });
        }

        if (
          tournament.competitionFormat ===
          'SINGLE_ELIMINATION'
        ) {
          const byRound =
            new Map<
              number,
              typeof fixtures
            >();

          for (
            const fixture
            of fixtures
          ) {
            const round =
              byRound.get(
                fixture.roundNumber,
              ) ??
              [];

            round.push(
              fixture,
            );

            byRound.set(
              fixture.roundNumber,
              round,
            );
          }

          const rounds =
            Array.from(
              byRound.keys(),
            ).sort(
              (
                a,
                b,
              ) =>
                a -
                b,
            );

          for (
            let index =
              0;
            index <
            rounds.length -
              1;
            index++
          ) {
            const current =
              byRound.get(
                rounds[
                  index
                ],
              ) ?? [];

            const next =
              byRound.get(
                rounds[
                  index +
                    1
                ],
              ) ?? [];

            for (
              let position =
                0;
              position <
              current.length;
              position++
            ) {
              const target =
                next[
                  Math.floor(
                    position /
                      2,
                  )
                ];

              if (!target) {
                continue;
              }

              await tx.fixture.update({
                where: {
                  id:
                    current[
                      position
                    ].id,
                },

                data: {
                  nextFixtureId:
                    target.id,

                  nextSlot:
                    position %
                      2 ===
                    0
                      ? 'HOME'
                      : 'AWAY',
                },
              });
            }
          }
        }

        await tx.tournament.update({
          where: {
            id:
              tournamentId,
          },

          data: {
            fixturesPublishedAt:
              publishedAt,

            fixturesGeneratedAt:
              publishedAt,

            wizardStep:
              tournament.competitionFormat ===
              'GROUP_STAGE_KNOCKOUT'
                ? 'QUALIFICATION'
                : 'REVIEW',
          },
        });
      },
    );

    return {
      success: true,

      data: {
        message:
          `${fixtures.length} fixture(s) published.`,

        fixtures:
          fixtures.length,

        nextStep:
          tournament.competitionFormat ===
          'GROUP_STAGE_KNOCKOUT'
            ? 'QUALIFICATION'
            : 'REVIEW',
      },

      error: null,
    };
  }


  private validateFixtureSet(
    fixtures:
      Array<{
        id: string;
        groupId: string | null;
        roundNumber: number;
        homeRegistrationId: string | null;
        awayRegistrationId: string | null;
      }>,

    legType:
      string,

    competitionFormat:
      string,
  ) {
    const exactPairs =
      new Set<string>();

    const unordered =
      new Map<
        string,
        number
      >();

    const roundTeams =
      new Set<string>();

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
        if (
          competitionFormat ===
          'SINGLE_ELIMINATION'
        ) {
          continue;
        }

        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'INCOMPLETE_FIXTURE',

            message:
              'Every published fixture requires both Home and Away teams.',
          },
        });
      }

      if (
        home ===
        away
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'SELF_FIXTURE',

            message:
              'A team cannot play itself.',
          },
        });
      }

      const groupKey =
        fixture.groupId ??
        'NO_GROUP';

      const exact =
        `${groupKey}:${home}:${away}`;

      if (
        exactPairs.has(
          exact,
        )
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'DUPLICATE_FIXTURE',

            message:
              'Duplicate fixture detected.',
          },
        });
      }

      exactPairs.add(
        exact,
      );

      const pair =
        [
          home,
          away,
        ]
          .sort()
          .join(':');

      const unorderedKey =
        `${groupKey}:${pair}`;

      unordered.set(
        unorderedKey,
        (unordered.get(
          unorderedKey,
        ) ??
          0) + 1,
      );

      const homeRound =
        `${groupKey}:${fixture.roundNumber}:${home}`;

      const awayRound =
        `${groupKey}:${fixture.roundNumber}:${away}`;

      if (
        roundTeams.has(
          homeRound,
        ) ||
        roundTeams.has(
          awayRound,
        )
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'TEAM_DUPLICATED_IN_ROUND',

            message:
              'A team cannot appear twice in the same round.',
          },
        });
      }

      roundTeams.add(
        homeRound,
      );

      roundTeams.add(
        awayRound,
      );
    }

    if (
      competitionFormat !==
        'SINGLE_ELIMINATION' &&
      competitionFormat !==
        'CUSTOM_MANUAL'
    ) {
      const expectedPerPair =
        legType ===
        'HOME_AWAY'
          ? 2
          : 1;

      for (
        const count
        of unordered.values()
      ) {
        if (
          count >
          expectedPerPair
        ) {
          throw new ConflictException({
            success: false,
            data: null,

            error: {
              code:
                'TOO_MANY_PAIRINGS',

              message:
                'One or more teams are scheduled against each other too many times.',
            },
          });
        }
      }
    }
  }


  private async assertNoDuplicate(
    tournamentId:
      string,

    homeId:
      string,

    awayId:
      string,

    ignoreFixtureId?:
      string,
  ) {
    const duplicate =
      await this.prisma.fixture.findFirst({
        where: {
          tournamentId,

          publishedAt:
            null,

          ...(ignoreFixtureId
            ? {
                id: {
                  not:
                    ignoreFixtureId,
                },
              }
            : {}),

          OR: [
            {
              homeRegistrationId:
                homeId,

              awayRegistrationId:
                awayId,
            },

            {
              homeRegistrationId:
                awayId,

              awayRegistrationId:
                homeId,
            },
          ],
        },
      });

    if (
      duplicate
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'DUPLICATE_FIXTURE',

          message:
            'These teams already have a draft fixture.',
        },
      });
    }
  }


  private async validateParticipants(
    tournamentId:
      string,

    homeId:
      string,

    awayId:
      string,

    groupId?:
      string,
  ) {
    if (
      homeId ===
      awayId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'SELF_FIXTURE',

          message:
            'Home and Away teams must be different.',
        },
      });
    }

    const registrations =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          id: {
            in: [
              homeId,
              awayId,
            ],
          },

          tournamentId,

          status:
            'APPROVED',
        },
      });

    if (
      registrations.length !==
      2
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_FIXTURE_TEAMS',

          message:
            'Both teams must belong to this Tournament.',
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
            'CROSS_GROUP_FIXTURE',

          message:
            'Group-stage fixtures must contain teams from the same group.',
        },
      });
    }
  }


  private async getDraftFixture(
    tournamentId:
      string,

    fixtureId:
      string,
  ) {
    const fixture =
      await this.prisma.fixture.findFirst({
        where: {
          id:
            fixtureId,

          tournamentId,

          publishedAt:
            null,
        },
      });

    if (!fixture) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'DRAFT_FIXTURE_NOT_FOUND',

          message:
            'Draft fixture could not be found.',
        },
      });
    }

    return fixture;
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
            'Fixture preview can only be edited before the Tournament is published.',
        },
      });
    }
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
}