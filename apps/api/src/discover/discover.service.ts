import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

type DiscoverType =
  | 'all'
  | 'players'
  | 'leagues'
  | 'tournaments'
  | 'seasons';

@Injectable()
export class DiscoverService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async search(
    userId: string,
    rawQuery?: string,
    rawType?: string,
    rawLimit?: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const query =
      (rawQuery ?? '')
        .trim()
        .slice(
          0,
          80,
        );

    const type =
      this.normalizeType(
        rawType,
      );

    const requested =
      Number(
        rawLimit,
      );

    const limit =
      Number.isFinite(
        requested,
      )
        ? Math.max(
            3,
            Math.min(
              20,
              Math.floor(
                requested,
              ),
            ),
          )
        : 8;

    if (
      query.length <
      2
    ) {
      return {
        success: true,

        data: {
          query,
          type,
          minimumQueryLength:
            2,
          total: 0,
          players: [],
          leagues: [],
          tournaments: [],
          seasons: [],
        },

        error: null,
      };
    }

    const memberLeagueIds =
      await this.memberLeagueIds(
        userId,
      );

    const [
      players,
      leagues,
      tournaments,
      seasons,
    ] =
      await Promise.all([
        type ===
          'all' ||
        type ===
          'players'
          ? this.searchPlayers(
              query,
              limit,
            )
          : [],

        type ===
          'all' ||
        type ===
          'leagues'
          ? this.searchLeagues(
              userId,
              query,
              limit,
            )
          : [],

        type ===
          'all' ||
        type ===
          'tournaments'
          ? this.searchTournaments(
              memberLeagueIds,
              query,
              limit,
            )
          : [],

        type ===
          'all' ||
        type ===
          'seasons'
          ? this.searchSeasons(
              query,
              limit,
            )
          : [],
      ]);

    return {
      success: true,

      data: {
        query,
        type,
        minimumQueryLength:
          2,

        total:
          players.length +
          leagues.length +
          tournaments.length +
          seasons.length,

        players,
        leagues,
        tournaments,
        seasons,
      },

      error: null,
    };
  }

  async featured(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const memberLeagueIds =
      await this.memberLeagueIds(
        userId,
      );

    const [
      tournaments,
      leagues,
      seasons,
      seasonalAwards,
    ] =
      await Promise.all([
        this.prisma.tournament.findMany({
          where: {
            status: {
              in: [
                'REGISTRATION_OPEN',
                'REGISTRATION_CLOSED',
                'ACTIVE',
              ],
            },

            OR: [
              {
                visibility:
                  'PUBLIC',
              },

              ...(memberLeagueIds.length >
              0
                ? [
                    {
                      leagueId: {
                        in:
                          memberLeagueIds,
                      },
                    },
                  ]
                : []),
            ],
          },

          select: {
            id: true,
            name: true,
            code: true,
            logoUrl: true,
            mode: true,
            format: true,
            status: true,
            visibility: true,
            startAt: true,
            endAt: true,

            league: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                region: true,
              },
            },

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

          orderBy: [
            {
              startAt:
                'asc',
            },
            {
              updatedAt:
                'desc',
            },
          ],

          take: 8,
        }),

        this.prisma.league.findMany({
          select: {
            id: true,
            name: true,
            logoUrl: true,
            region: true,
            description: true,

            _count: {
              select: {
                members: true,
                tournaments: true,
              },
            },
          },

          orderBy: {
            members: {
              _count:
                'desc',
            },
          },

          take: 6,
        }),

        this.prisma.ballonSeason.findMany({
          where: {
            status: {
              in: [
                'LIVE',
                'FINALIZING',
                'LOCKED',
                'ARCHIVED',
              ],
            },
          },

          select: {
            id: true,
            name: true,
            status: true,
            startAt: true,
            endAt: true,
            minimumMatches: true,
            rankingLimit: true,
            finalWinnerUserId: true,
            risingStarUserId: true,
          },

          orderBy: {
            startAt:
              'desc',
          },

          take: 4,
        }),

        this.prisma.seasonalAward.findMany({
          include: {
            user: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    playerCode:
                      true,
                    profileImageUrl:
                      true,

                    identity: {
                      select: {
                        inGameName:
                          true,
                      },
                    },
                  },
                },
              },
            },

            season: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },

          orderBy: {
            awardedAt:
              'desc',
          },

          take: 8,
        }),
      ]);

    return {
      success: true,

      data: {
        tournaments:
          tournaments.map(
            (
              tournament,
            ) => ({
              ...tournament,
              approvedEntries:
                tournament
                  ._count
                  .registrations,
              _count:
                undefined,
            }),
          ),

        leagues:
          leagues.map(
            (
              league,
            ) => ({
              ...league,
              members:
                league
                  ._count
                  .members,
              tournaments:
                league
                  ._count
                  .tournaments,
              joined:
                memberLeagueIds.includes(
                  league.id,
                ),
              _count:
                undefined,
            }),
          ),

        seasons,

        recentHonours:
          seasonalAwards.map(
            (
              award,
            ) => ({
              id:
                award.id,
              type:
                award.type,
              title:
                award.title,
              description:
                award.description,
              awardedAt:
                award.awardedAt,
              season:
                award.season,

              player:
                this.publicIdentity(
                  award.user,
                ),
            }),
          ),
      },

      error: null,
    };
  }

  async hallOfFame(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const [
      seasons,
      achievements,
      seasonalAwards,
      finalRankings,
    ] =
      await Promise.all([
        this.prisma.ballonSeason.findMany({
          where: {
            status: {
              in: [
                'LOCKED',
                'ARCHIVED',
              ],
            },
          },

          include: {
            finalWinner: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    playerCode:
                      true,
                    profileImageUrl:
                      true,

                    identity: {
                      select: {
                        inGameName:
                          true,
                      },
                    },
                  },
                },
              },
            },

            risingStar: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    playerCode:
                      true,
                    profileImageUrl:
                      true,

                    identity: {
                      select: {
                        inGameName:
                          true,
                      },
                    },
                  },
                },
              },
            },

            finalRankings: {
              orderBy: {
                rank:
                  'asc',
              },

              take: 3,

              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,

                    player: {
                      select: {
                        playerCode:
                          true,
                        profileImageUrl:
                          true,

                        identity: {
                          select: {
                            inGameName:
                              true,
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
            startAt:
              'desc',
          },

          take: 50,
        }),

        this.prisma.achievement.findMany({
          where: {
            type: {
              not:
                'TOURNAMENT_PARTICIPATION',
            },
          },

          select: {
            id: true,
            userId: true,
            type: true,
            title: true,
            description: true,
            metadata: true,
            awardedAt: true,

            tournament: {
              select: {
                id: true,
                name: true,
                code: true,
                mode: true,
                format: true,
                completedAt: true,

                league: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },

            user: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    playerCode:
                      true,
                    profileImageUrl:
                      true,

                    identity: {
                      select: {
                        inGameName:
                          true,
                      },
                    },
                  },
                },
              },
            },
          },

          orderBy: {
            awardedAt:
              'desc',
          },

          take: 500,
        }),

        this.prisma.seasonalAward.findMany({
          include: {
            user: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    playerCode:
                      true,
                    profileImageUrl:
                      true,

                    identity: {
                      select: {
                        inGameName:
                          true,
                      },
                    },
                  },
                },
              },
            },

            season: {
              select: {
                id: true,
                name: true,
              },
            },
          },

          orderBy: {
            awardedAt:
              'desc',
          },

          take: 200,
        }),

        this.prisma.ballonFinalRanking.findMany({
          select: {
            userId: true,
            rank: true,
            rating: true,

            user: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    playerCode:
                      true,
                    profileImageUrl:
                      true,

                    identity: {
                      select: {
                        inGameName:
                          true,
                      },
                    },
                  },
                },
              },
            },
          },

          take: 1000,
        }),
      ]);

    const legends =
      new Map<
        string,
        {
          userId: string;
          player:
            ReturnType<
              DiscoverService[
                'publicIdentity'
              ]
            >;
          ballonWins: number;
          ballonPodiums: number;
          risingStars: number;
          tournamentTitles: number;
          tournamentRunnerUps: number;
          goldenBoots: number;
          goldenGloves: number;
          playerOfTournament: number;
          winningStreakAwards: number;
          honourScore: number;
        }
      >();

    const ensureLegend =
      (
        user:
          any,
      ) => {
        let row =
          legends.get(
            user.id,
          );

        if (!row) {
          row = {
            userId:
              user.id,
            player:
              this.publicIdentity(
                user,
              ),
            ballonWins: 0,
            ballonPodiums: 0,
            risingStars: 0,
            tournamentTitles: 0,
            tournamentRunnerUps: 0,
            goldenBoots: 0,
            goldenGloves: 0,
            playerOfTournament: 0,
            winningStreakAwards: 0,
            honourScore: 0,
          };

          legends.set(
            user.id,
            row,
          );
        }

        return row;
      };

    for (
      const award
      of seasonalAwards
    ) {
      const row =
        ensureLegend(
          award.user,
        );

      if (
        award.type ===
        'FC_ARENA_BALLON'
      ) {
        row.ballonWins +=
          1;
      } else if (
        award.type ===
        'RISING_STAR'
      ) {
        row.risingStars +=
          1;
      }
    }

    for (
      const ranking
      of finalRankings
    ) {
      if (
        ranking.rank <=
        3
      ) {
        ensureLegend(
          ranking.user,
        ).ballonPodiums +=
          1;
      }
    }

    for (
      const achievement
      of achievements
    ) {
      const row =
        ensureLegend(
          achievement.user,
        );

      if (
        achievement.type ===
        'TOURNAMENT_CHAMPION'
      ) {
        row.tournamentTitles +=
          1;
      } else if (
        achievement.type ===
        'TOURNAMENT_RUNNER_UP'
      ) {
        row.tournamentRunnerUps +=
          1;
      } else if (
        achievement.type ===
        'GOLDEN_BOOT'
      ) {
        row.goldenBoots +=
          1;
      } else if (
        achievement.type ===
        'GOLDEN_GLOVE'
      ) {
        row.goldenGloves +=
          1;
      } else if (
        achievement.type ===
        'BEST_PLAYER'
      ) {
        row.playerOfTournament +=
          1;
      } else if (
        achievement.type ===
        'WINNING_STREAK'
      ) {
        row.winningStreakAwards +=
          1;
      }
    }

    for (
      const row
      of legends.values()
    ) {
      row.honourScore =
        row.ballonWins *
          50 +
        row.ballonPodiums *
          15 +
        row.risingStars *
          12 +
        row.tournamentTitles *
          10 +
        row.tournamentRunnerUps *
          5 +
        row.playerOfTournament *
          6 +
        row.goldenBoots *
          5 +
        row.goldenGloves *
          5 +
        row.winningStreakAwards *
          2;
    }

    const legendsList =
      [
        ...legends.values(),
      ]
        .sort(
          (
            a,
            b,
          ) =>
            b.honourScore -
              a.honourScore ||
            b.ballonWins -
              a.ballonWins ||
            b.tournamentTitles -
              a.tournamentTitles ||
            a.player.playerCode.localeCompare(
              b.player.playerCode,
            ),
        )
        .slice(
          0,
          50,
        );

    const champions =
      achievements
        .filter(
          (
            achievement,
          ) =>
            achievement.type ===
            'TOURNAMENT_CHAMPION',
        )
        .slice(
          0,
          30,
        )
        .map(
          (
            achievement,
          ) => ({
            id:
              achievement.id,
            awardedAt:
              achievement.awardedAt,
            player:
              this.publicIdentity(
                achievement.user,
              ),
            tournament:
              achievement.tournament,
          }),
        );

    return {
      success: true,

      data: {
        seasons:
          seasons.map(
            (
              season,
            ) => ({
              id:
                season.id,
              name:
                season.name,
              status:
                season.status,
              startAt:
                season.startAt,
              endAt:
                season.endAt,
              lockedAt:
                season.lockedAt,
              archivedAt:
                season.archivedAt,

              winner:
                season.finalWinner
                  ? this.publicIdentity(
                      season.finalWinner,
                    )
                  : null,

              risingStar:
                season.risingStar
                  ? this.publicIdentity(
                      season.risingStar,
                    )
                  : null,

              podium:
                season.finalRankings.map(
                  (
                    ranking,
                  ) => ({
                    rank:
                      ranking.rank,
                    rating:
                      ranking.rating,
                    player:
                      this.publicIdentity(
                        ranking.user,
                      ),
                  }),
                ),
            }),
          ),

        legends:
          legendsList,

        champions,

        totals: {
          seasons:
            seasons.length,
          recordedHonours:
            achievements.length +
            seasonalAwards.length,
          champions:
            champions.length,
          legends:
            legendsList.length,
        },

        scoringNote:
          'Hall of Fame Honour Score is a display-only historical summary. It does not change tournament standings, Ballon ratings, awards or player eligibility.',
      },

      error: null,
    };
  }

  async publicPlayer(
    requesterUserId: string,
    playerUserId: string,
  ) {
    await this.assertActiveUser(
      requesterUserId,
    );

    const user =
      await this.prisma.user.findFirst({
        where: {
          id:
            playerUserId,
          status:
            'ACTIVE',
        },

        select: {
          id: true,
          fullName: true,
          createdAt: true,

          player: {
            select: {
              playerCode: true,
              profileImageUrl:
                true,

              identity: {
                select: {
                  inGameName:
                    true,
                  isVerified:
                    true,
                },
              },
            },
          },

          leagueMemberships: {
            select: {
              type: true,
              joinedAt: true,

              league: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                  region: true,
                },
              },
            },

            orderBy: {
              joinedAt:
                'asc',
            },
          },

          achievements: {
            where: {
              type: {
                not:
                  'TOURNAMENT_PARTICIPATION',
              },
            },

            select: {
              id: true,
              type: true,
              title: true,
              description: true,
              metadata: true,
              awardedAt: true,

              tournament: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  completedAt:
                    true,

                  league: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },

            orderBy: {
              awardedAt:
                'desc',
            },

            take: 100,
          },

          seasonalAwards: {
            select: {
              id: true,
              type: true,
              title: true,
              description: true,
              metadata: true,
              awardedAt: true,

              season: {
                select: {
                  id: true,
                  name: true,
                  startAt: true,
                  endAt: true,
                  status: true,
                },
              },
            },

            orderBy: {
              awardedAt:
                'desc',
            },

            take: 50,
          },

          ballonFinalRankings: {
            select: {
              rank: true,
              rating: true,
              createdAt: true,

              season: {
                select: {
                  id: true,
                  name: true,
                  startAt: true,
                  endAt: true,
                  status: true,
                },
              },
            },

            orderBy: {
              createdAt:
                'desc',
            },

            take: 50,
          },

          playerTournamentStatistics: {
            select: {
              matches: true,
              wins: true,
              draws: true,
              losses: true,
              goalsFor: true,
              goalsAgainst: true,
              goalDifference: true,
            },
          },
        },
      });

    if (
      !user ||
      !user.player
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'DISCOVER_PLAYER_NOT_FOUND',

          message:
            'Player could not be found.',
        },
      });
    }

    const totals =
      user
        .playerTournamentStatistics
        .reduce(
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
            aggregate.goalDifference +=
              statistic.goalDifference;

            return aggregate;
          },
          {
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
          },
        );

    const winRate =
      totals.matches >
      0
        ? Number(
            (
              (
                totals.wins /
                totals.matches
              ) *
              100
            ).toFixed(
              1,
            ),
          )
        : 0;

    return {
      success: true,

      data: {
        player: {
          ...this.publicIdentity(
            user,
          ),
          joinedAt:
            user.createdAt,
          verified:
            user.player
              .identity
              ?.isVerified ??
            false,
        },

        leagues:
          user.leagueMemberships,

        lifetimeStatistics: {
          ...totals,
          winRate,
          achievements:
            user
              .achievements
              .length,
          seasonalAwards:
            user
              .seasonalAwards
              .length,
        },

        achievements:
          user.achievements,

        seasonalAwards:
          user.seasonalAwards,

        ballonHistory:
          user.ballonFinalRankings,
      },

      error: null,
    };
  }

  private async searchPlayers(
    query: string,
    limit: number,
  ) {
    const rows =
      await this.prisma.user.findMany({
        where: {
          status:
            'ACTIVE',

          player: {
            isNot:
              null,
          },

          OR: [
            {
              fullName: {
                contains:
                  query,
                mode:
                  'insensitive',
              },
            },

            {
              player: {
                is: {
                  playerCode: {
                    contains:
                      query,
                    mode:
                      'insensitive',
                  },
                },
              },
            },

            {
              player: {
                is: {
                  identity: {
                    is: {
                      inGameName: {
                        contains:
                          query,
                        mode:
                          'insensitive',
                      },
                    },
                  },
                },
              },
            },
          ],
        },

        select: {
          id: true,
          fullName: true,

          player: {
            select: {
              playerCode: true,
              profileImageUrl:
                true,

              identity: {
                select: {
                  inGameName:
                    true,
                },
              },
            },
          },

          _count: {
            select: {
              achievements: {
                where: {
                  type: {
                    not:
                      'TOURNAMENT_PARTICIPATION',
                  },
                },
              },
              seasonalAwards:
                true,
            },
          },
        },

        orderBy: {
          fullName:
            'asc',
        },

        take:
          limit,
      });

    return rows.map(
      (
        row,
      ) => ({
        ...this.publicIdentity(
          row,
        ),
        honours:
          row
            ._count
            .achievements +
          row
            ._count
            .seasonalAwards,
      }),
    );
  }

  private async searchLeagues(
    userId: string,
    query: string,
    limit: number,
  ) {
    const rows =
      await this.prisma.league.findMany({
        where: {
          OR: [
            {
              name: {
                contains:
                  query,
                mode:
                  'insensitive',
              },
            },

            {
              region: {
                contains:
                  query,
                mode:
                  'insensitive',
              },
            },
          ],
        },

        select: {
          id: true,
          name: true,
          logoUrl: true,
          region: true,
          description: true,

          members: {
            where: {
              userId,
            },

            select: {
              id: true,
            },

            take: 1,
          },

          _count: {
            select: {
              members: true,
              tournaments: true,
            },
          },
        },

        orderBy: {
          name:
            'asc',
        },

        take:
          limit,
      });

    return rows.map(
      (
        row,
      ) => ({
        id:
          row.id,
        name:
          row.name,
        logoUrl:
          row.logoUrl,
        region:
          row.region,
        description:
          row.description,
        members:
          row
            ._count
            .members,
        tournaments:
          row
            ._count
            .tournaments,
        joined:
          row
            .members
            .length >
          0,
      }),
    );
  }

  private async searchTournaments(
    memberLeagueIds:
      string[],
    query: string,
    limit: number,
  ) {
    const rows =
      await this.prisma.tournament.findMany({
        where: {
          status: {
            notIn: [
              'DRAFT',
              'CANCELLED',
            ],
          },

          OR: [
            {
              visibility:
                'PUBLIC',
            },

            ...(memberLeagueIds.length >
            0
              ? [
                  {
                    leagueId: {
                      in:
                        memberLeagueIds,
                    },
                  },
                ]
              : []),
          ],

          AND: [
            {
              OR: [
                {
                  name: {
                    contains:
                      query,
                    mode:
                      'insensitive',
                  },
                },

                {
                  code: {
                    contains:
                      query,
                    mode:
                      'insensitive',
                  },
                },

                {
                  league: {
                    is: {
                      name: {
                        contains:
                          query,
                        mode:
                          'insensitive',
                      },
                    },
                  },
                },
              ],
            },
          ],
        },

        select: {
          id: true,
          name: true,
          code: true,
          logoUrl: true,
          mode: true,
          format: true,
          status: true,
          visibility: true,
          startAt: true,
          endAt: true,

          league: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              region: true,
            },
          },

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

        orderBy: {
          updatedAt:
            'desc',
        },

        take:
          limit,
      });

    return rows.map(
      (
        row,
      ) => ({
        ...row,
        approvedEntries:
          row
            ._count
            .registrations,
        _count:
          undefined,
      }),
    );
  }

  private async searchSeasons(
    query: string,
    limit: number,
  ) {
    const rows =
      await this.prisma.ballonSeason.findMany({
        where: {
          status: {
            in: [
              'LIVE',
              'FINALIZING',
              'LOCKED',
              'ARCHIVED',
            ],
          },

          name: {
            contains:
              query,
            mode:
              'insensitive',
          },
        },

        select: {
          id: true,
          name: true,
          status: true,
          startAt: true,
          endAt: true,
          minimumMatches: true,
          rankingLimit: true,
          finalWinnerUserId: true,
        },

        orderBy: {
          startAt:
            'desc',
        },

        take:
          limit,
      });

    return rows;
  }

  private async memberLeagueIds(
    userId: string,
  ) {
    const memberships =
      await this.prisma.leagueMember.findMany({
        where: {
          userId,
        },

        select: {
          leagueId: true,
        },
      });

    return memberships.map(
      (
        membership,
      ) =>
        membership.leagueId,
    );
  }

  private normalizeType(
    rawType?: string,
  ): DiscoverType {
    return [
      'players',
      'leagues',
      'tournaments',
      'seasons',
    ].includes(
      rawType ??
      '',
    )
      ? rawType as DiscoverType
      : 'all';
  }

  private publicIdentity(
    user:
      any,
  ) {
    return {
      userId:
        user.id,
      fullName:
        user.fullName,
      inGameName:
        user.player
          ?.identity
          ?.inGameName ??
        null,
      playerCode:
        user.player
          ?.playerCode ??
        'FC Player',
      profileImageUrl:
        user.player
          ?.profileImageUrl ??
        null,
    };
  }

  private async assertActiveUser(
    userId: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          status: true,
        },
      });

    if (
      !user ||
      user.status !==
      'ACTIVE'
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'ACTIVE_USER_REQUIRED',

          message:
            'An active FC Arena account is required.',
        },
      });
    }
  }
}
