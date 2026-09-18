import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class PlayerCareerService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getMyCareer(
    userId: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          createdAt: true,

          player: {
            select: {
              playerCode: true,
              profileImageUrl: true,

              identity: {
                select: {
                  inGameName: true,
                  gameUid: true,
                  isVerified: true,
                  verifiedAt: true,
                },
              },
            },
          },

          leagueMemberships: {
            include: {
              league: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  logoUrl: true,
                  region: true,
                },
              },
            },

            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      });

    if (!user) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'PLAYER_NOT_FOUND',

          message:
            'Player could not be found.',
        },
      });
    }

    const statistics =
      await this.prisma.playerTournamentStatistic.findMany({
        where: {
          userId,
        },

        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              code: true,
              mode: true,
              format: true,
              status: true,
              startAt: true,
              completedAt: true,

              league: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },

        orderBy: {
          updatedAt: 'desc',
        },
      });

    const tournamentEntries =
      await this.prisma.tournamentRegistrationMember.findMany({
        where: {
          userId,
        },

        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              code: true,
              mode: true,
              format: true,
              status: true,
              startAt: true,
              completedAt: true,

              league: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },

          registration: {
            select: {
              id: true,
              entryName: true,
              status: true,
              createdAt: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

    const matches =
      await this.prisma.match.findMany({
        where: {
          confirmedResultSubmissionId: {
            not: null,
          },

          OR: [
            {
              fixture: {
                homeRegistration: {
                  is: {
                    members: {
                      some: {
                        userId,
                      },
                    },
                  },
                },
              },
            },

            {
              fixture: {
                awayRegistration: {
                  is: {
                    members: {
                      some: {
                        userId,
                      },
                    },
                  },
                },
              },
            },
          ],
        },

        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              code: true,
              mode: true,
              format: true,

              league: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },

          confirmedResult: {
            select: {
              id: true,
              homeScore: true,
              awayScore: true,
              source: true,
              reviewedAt: true,
              updatedAt: true,
            },
          },

          fixture: {
            include: {
              homeRegistration: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          fullName: true,

                          player: {
                            select: {
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
              },

              awayRegistration: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          fullName: true,

                          player: {
                            select: {
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
              },
            },
          },
        },

        orderBy: {
          updatedAt: 'desc',
        },

        take: 100,
      });

    const achievements =
      await this.prisma.achievement.findMany({
        where: {
          userId,
        },

        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              code: true,
              mode: true,
              format: true,
              completedAt: true,
            },
          },
        },

        orderBy: {
          awardedAt: 'desc',
        },
      });

    const totals =
      statistics.reduce(
        (
          aggregate,
          statistic,
        ) => {
          aggregate.matches +=
            statistic.matches;

          aggregate.wins +=
            statistic.wins;

          aggregate.draws +=
            statistic.draws;

          aggregate.losses +=
            statistic.losses;

          aggregate.goalsFor +=
            statistic.goalsFor;

          aggregate.goalsAgainst +=
            statistic.goalsAgainst;

          return aggregate;
        },
        {
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
        },
      );

    const goalDifference =
      totals.goalsFor -
      totals.goalsAgainst;

    const winRate =
      totals.matches > 0
        ? Number(
            (
              (
                totals.wins /
                totals.matches
              ) *
              100
            ).toFixed(1),
          )
        : 0;

    const matchHistory =
      matches
        .map((match) => {
          const result =
            match.confirmedResult;

          if (!result) {
            return null;
          }

          const homeMembers =
            match.fixture
              .homeRegistration
              ?.members ??
            [];

          const awayMembers =
            match.fixture
              .awayRegistration
              ?.members ??
            [];

          const isHome =
            homeMembers.some(
              (member) =>
                member.userId ===
                userId,
            );

          const isAway =
            awayMembers.some(
              (member) =>
                member.userId ===
                userId,
            );

          if (
            !isHome &&
            !isAway
          ) {
            return null;
          }

          let outcome:
            'W' | 'D' | 'L';

          if (
            result.homeScore ===
            result.awayScore
          ) {
            outcome = 'D';
          } else if (isHome) {
            outcome =
              result.homeScore >
              result.awayScore
                ? 'W'
                : 'L';
          } else {
            outcome =
              result.awayScore >
              result.homeScore
                ? 'W'
                : 'L';
          }

          return {
            id: match.id,

            matchCode:
              match.matchCode,

            status:
              match.status,

            outcome,

            tournament: {
              id:
                match.tournament.id,

              name:
                match.tournament.name,

              code:
                match.tournament.code,

              mode:
                match.tournament.mode,

              format:
                match.tournament.format,

              league:
                match.tournament.league,
            },

            fixture: {
              id:
                match.fixture.id,

              roundName:
                match.fixture.roundName,

              roundNumber:
                match.fixture.roundNumber,

              matchday:
                match.fixture.matchday,

              scheduledAt:
                match.fixture.scheduledAt,

              venue:
                match.fixture.venue,
            },

            home: {
              name:
                this.registrationName(
                  match.fixture
                    .homeRegistration,
                ),

              score:
                result.homeScore,
            },

            away: {
              name:
                this.registrationName(
                  match.fixture
                    .awayRegistration,
                ),

              score:
                result.awayScore,
            },

            source:
              result.source,

            confirmedAt:
              result.reviewedAt ??
              result.updatedAt,
          };
        })
        .filter(
          (
            match,
          ): match is NonNullable<
            typeof match
          > => match !== null,
        );

    const recentForm =
      matchHistory
        .slice(0, 5)
        .map(
          (match) =>
            match.outcome,
        );

    const statisticsByTournament =
      new Map(
        statistics.map(
          (statistic) => [
            statistic.tournamentId,
            statistic,
          ],
        ),
      );

    const tournamentHistory =
      tournamentEntries.map(
        (entry) => {
          const statistic =
            statisticsByTournament.get(
              entry.tournamentId,
            );

          return {
            tournament:
              entry.tournament,

            registration: {
              id:
                entry.registration.id,

              entryName:
                entry.registration
                  .entryName,

              status:
                entry.registration
                  .status,

              joinedAt:
                entry.createdAt,
            },

            statistics: {
              matches:
                statistic?.matches ??
                0,

              wins:
                statistic?.wins ??
                0,

              draws:
                statistic?.draws ??
                0,

              losses:
                statistic?.losses ??
                0,

              goalsFor:
                statistic?.goalsFor ??
                0,

              goalsAgainst:
                statistic?.goalsAgainst ??
                0,

              goalDifference:
                statistic?.goalDifference ??
                0,

              form:
                statistic?.form ??
                '',
            },
          };
        },
      );

    const leagueHistory =
      user.leagueMemberships.map(
        (membership) => ({
          id:
            membership.id,

          type:
            membership.type,

          joinedAt:
            membership.joinedAt,

          league:
            membership.league,
        }),
      );

    const primaryLeague =
      leagueHistory.find(
        (membership) =>
          membership.type ===
          'PRIMARY',
      ) ?? null;

    const secondaryLeague =
      leagueHistory.find(
        (membership) =>
          membership.type ===
          'SECONDARY',
      ) ?? null;

    return {
      success: true,

      data: {
        profile: {
          id:
            user.id,

          fullName:
            user.fullName,

          email:
            user.email,

          phoneNumber:
            user.phoneNumber,

          joinedAt:
            user.createdAt,

          playerCode:
            user.player
              ?.playerCode ??
            null,

          profileImageUrl:
            user.player
              ?.profileImageUrl ??
            null,

          identity:
            user.player
              ?.identity ??
            null,

          primaryLeague,

          secondaryLeague,
        },

        lifetimeStatistics: {
          ...totals,

          goalDifference,

          winRate,

          form:
            recentForm,

          tournaments:
            tournamentHistory.length,

          achievements:
            achievements.length,
        },

        matchHistory,

        tournamentHistory,

        leagueHistory,

        achievements,
      },

      error: null,
    };
  }

  private registrationName(
    registration:
      | any
      | null,
  ) {
    if (!registration) {
      return 'TBD';
    }

    if (
      registration.entryName
    ) {
      return registration.entryName;
    }

    const names =
      registration.members.map(
        (member: any) =>
          member.user.player
            ?.identity
            ?.inGameName ??
          member.user.fullName,
      );

    return (
      names.join(' + ') ||
      'TBD'
    );
  }
}