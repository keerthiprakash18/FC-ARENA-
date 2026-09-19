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
  PublishFixturePreviewDto,
} from './dto/publish-fixture-preview.dto.js';

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
      tournament.legType,
      tournament.competitionFormat,
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
            `Matchday ${dto.roundNumber}`,

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
      tournament.legType,
      tournament.competitionFormat,
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
              ? `Matchday ${roundNumber}`
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

    await this.assertNoDuplicate(
      tournamentId,
      fixture.awayRegistrationId,
      fixture.homeRegistrationId,
      tournament.legType,
      tournament.competitionFormat,
      fixture.id,
    );

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
    dto:
      PublishFixturePreviewDto = {},
  ) {
    const tournament =
      await this.getAdminTournament(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    if (
      dto.groupId
    ) {
      await this.assertGroupBelongsToTournament(
        tournamentId,
        dto.groupId,
      );
    }

    const fixtures =
      await this.prisma.fixture.findMany({
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

    await this.validateFixtureSet(
      tournamentId,
      fixtures,
      tournament.legType,
      tournament.competitionFormat,
      dto.registrationIds,
      dto.groupId,
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
          !dto.groupId &&
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
            fixturesGeneratedAt:
              publishedAt,

            ...(dto.groupId
              ? {}
              : {
                  fixturesPublishedAt:
                    publishedAt,

                  wizardStep:
                    tournament.competitionFormat ===
                    'GROUP_STAGE_KNOCKOUT'
                      ? 'QUALIFICATION'
                      : 'REVIEW',
                }),
          },
        });
      },
    );

    return {
      success: true,

      data: {
        message:
          dto.groupId
            ? `${fixtures.length} Group fixture(s) saved.`
            : `${fixtures.length} fixture(s) published.`,

        fixtures:
          fixtures.length,

        scope:
          dto.groupId
            ? 'GROUP'
            : 'TOURNAMENT',

        nextStep:
          dto.groupId
            ? 'FIXTURES'
            : tournament.competitionFormat ===
              'GROUP_STAGE_KNOCKOUT'
              ? 'QUALIFICATION'
              : 'REVIEW',
      },

      error: null,
    };
  }


  private async validateFixtureSet(
    tournamentId:
      string,

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

    selectedRegistrationIds?:
      string[],

    selectedGroupId?:
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

    const participantIds =
      new Set<string>();

    const roundNumbersByGroup =
      new Map<
        string,
        Set<number>
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
              'Every saved fixture requires both Home and Away participants.',
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
              'A participant cannot play itself.',
          },
        });
      }

      participantIds.add(
        home,
      );

      participantIds.add(
        away,
      );

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
              'Duplicate Home/Away fixture detected.',
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
              'A participant cannot appear twice in the same Matchday.',
          },
        });
      }

      roundTeams.add(
        homeRound,
      );

      roundTeams.add(
        awayRound,
      );

      const rounds =
        roundNumbersByGroup.get(
          groupKey,
        ) ??
        new Set<number>();

      rounds.add(
        fixture.roundNumber,
      );

      roundNumbersByGroup.set(
        groupKey,
        rounds,
      );
    }

    if (
      competitionFormat ===
      'SINGLE_ELIMINATION' ||
      competitionFormat ===
      'CUSTOM_MANUAL'
    ) {
      return;
    }

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
              'One or more participants are scheduled against each other too many times.',
          },
        });
      }
    }

    const expectedParticipants =
      await this.getExpectedParticipantsByGroup(
        tournamentId,
        selectedRegistrationIds ??
          Array.from(
            participantIds,
          ),
        selectedGroupId,
      );

    for (
      const [
        groupKey,
        ids,
      ]
      of expectedParticipants.entries()
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
              'NOT_ENOUGH_FIXTURE_PARTICIPANTS',

            message:
              'Each fixture scope requires at least two participants.',
          },
        });
      }

      const expectedPairCount =
        (
          ids.length *
          (
            ids.length -
            1
          )
        ) /
        2;

      const expectedFixtures =
        expectedPairCount *
        expectedPerPair;

      const actualFixtures =
        fixtures.filter(
          (
            fixture,
          ) =>
            (
              fixture.groupId ??
              'NO_GROUP'
            ) ===
            groupKey,
        );

      if (
        actualFixtures.length !==
        expectedFixtures
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'INCOMPLETE_ROUND_ROBIN',

            message:
              `Fixture set is incomplete. Expected ${expectedFixtures} match(es) for this scope, received ${actualFixtures.length}.`,
          },
        });
      }

      for (
        let left =
            0;
          left <
          ids.length;
        left++
      ) {
        for (
          let right =
              left +
              1;
            right <
            ids.length;
          right++
        ) {
          const pair =
            [
              ids[left],
              ids[right],
            ]
              .sort()
              .join(':');

          const count =
            unordered.get(
              `${groupKey}:${pair}`,
            ) ??
            0;

          if (
            count !==
            expectedPerPair
          ) {
            throw new ConflictException({
              success: false,
              data: null,

              error: {
                code:
                  'MISSING_PAIRING',

                message:
                  'Every selected participant must play every other selected participant the required number of times.',
              },
            });
          }
        }
      }

      const expectedRounds =
        (
          ids.length %
          2 ===
          0
            ? ids.length -
              1
            : ids.length
        ) *
        expectedPerPair;

      const actualRounds =
        roundNumbersByGroup.get(
          groupKey,
        )?.size ??
        0;

      if (
        actualRounds !==
        expectedRounds
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'INVALID_MATCHDAY_COUNT',

            message:
              `Fixture set requires ${expectedRounds} Matchday(s), received ${actualRounds}.`,
          },
        });
      }
    }
  }


  private async getExpectedParticipantsByGroup(
    tournamentId:
      string,

    registrationIds:
      string[],

    selectedGroupId?:
      string,
  ) {
    const unique =
      [
        ...new Set(
          registrationIds,
        ),
      ];

    const registrations =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,

          status:
            'APPROVED',

          id: {
            in:
              unique,
          },
        },

        select: {
          id: true,
          groupId: true,
        },
      });

    if (
      registrations.length !==
      unique.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_FIXTURE_PARTICIPANTS',

          message:
            'One or more selected participants no longer belong to this Tournament.',
        },
      });
    }

    if (
      selectedGroupId &&
      registrations.some(
        (
          registration,
        ) =>
          registration.groupId !==
          selectedGroupId,
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

    const result =
      new Map<
        string,
        string[]
      >();

    for (
      const registration
      of registrations
    ) {
      const key =
        registration.groupId ??
        'NO_GROUP';

      const ids =
        result.get(
          key,
        ) ??
        [];

      ids.push(
        registration.id,
      );

      result.set(
        key,
        ids,
      );
    }

    return result;
  }


  private async assertNoDuplicate(
    tournamentId:
      string,

    homeId:
      string,

    awayId:
      string,

    legType:
      string,

    competitionFormat:
      string,

    ignoreFixtureId?:
      string,
  ) {
    const matches =
      await this.prisma.fixture.findMany({
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

        select: {
          homeRegistrationId:
            true,

          awayRegistrationId:
            true,
        },
      });

    if (
      matches.some(
        (
          fixture,
        ) =>
          fixture.homeRegistrationId ===
            homeId &&
          fixture.awayRegistrationId ===
            awayId,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'DUPLICATE_FIXTURE',

          message:
            'This exact Home/Away fixture already exists.',
        },
      });
    }

    const allowedPairCount =
      competitionFormat ===
        'CUSTOM_MANUAL'
        ? 2
        : legType ===
          'HOME_AWAY'
          ? 2
          : 1;

    if (
      matches.length >=
      allowedPairCount
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOO_MANY_PAIRINGS',

          message:
            'These participants already meet the maximum number of times for this fixture setup.',
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
            'Home and Away participants must be different.',
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
            'Both participants must belong to this Tournament.',
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
            'Group-stage fixtures must contain participants from the same Group.',
        },
      });
    }
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
