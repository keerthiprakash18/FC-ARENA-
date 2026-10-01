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

import {
  calculatePerformanceRatings,
  DEFAULT_RATING_WEIGHTS,
  type AwardMetricRow,
  type RatingWeights,
} from '../achievements/award-scoring.js';

import {
  deduplicateFixtureRecords,
  isCanonicalCompletedFixture,
} from '../tournaments/fixture-deduplication.js';

import type {
  CreateBallonSeasonDto,
} from './dto/create-ballon-season.dto.js';

import type {
  UpdateBallonSeasonDto,
} from './dto/update-ballon-season.dto.js';

interface SeasonStats
  extends AwardMetricRow {
  tournamentsPlayed: number;
  tournamentTitles: number;
  firstCompetitiveAt:
    string | null;
}

interface PlayerIdentity {
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
}

interface LiveRankingRow
  extends SeasonStats,
    PlayerIdentity {
  position: number;
  previousPosition:
    number | null;
  rankChange:
    number | null;
  eligible: boolean;
  rating: number;
  ratingBreakdown:
    Record<
      string,
      number
    >;
}

@Injectable()
export class BallonService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async createSeason(
    userId: string,
    dto:
      CreateBallonSeasonDto,
  ) {
    const startAt =
      new Date(
        dto.startAt,
      );

    const endAt =
      new Date(
        dto.endAt,
      );

    this.assertValidPeriod(
      startAt,
      endAt,
    );

    const eligibleLeagueIds =
      this.uniqueIds(
        dto.eligibleLeagueIds,
      );

    const eligibleTournamentIds =
      this.uniqueIds(
        dto.eligibleTournamentIds,
      );

    await this.assertCanManageScope(
      userId,
      eligibleLeagueIds,
      eligibleTournamentIds,
    );

    await this.assertScopeExists(
      eligibleLeagueIds,
      eligibleTournamentIds,
    );

    const scoringConfig =
      this.normalizeScoringConfig(
        dto.scoringConfig,
      );

    const minimumMatches =
      dto.minimumMatches ??
      this.defaultMinimumMatches(
        startAt,
        endAt,
      );

    const season =
      await this.prisma.ballonSeason.create({
        data: {
          name:
            dto.name.trim(),
          startAt,
          endAt,
          minimumMatches,
          rankingLimit:
            dto.rankingLimit ??
            20,
          eligibleLeagueIds,
          eligibleTournamentIds,
          scoringConfig:
            scoringConfig as any,
          createdByUserId:
            userId,
        },
      });

    return {
      success: true,
      data: {
        season,
      },
      error: null,
    };
  }

  async updateSeason(
    userId: string,
    seasonId: string,
    dto:
      UpdateBallonSeasonDto,
  ) {
    const season =
      await this.requireSeason(
        seasonId,
      );

    await this.assertCanManageSeason(
      userId,
      season,
    );

    if (
      season.status !==
      'DRAFT'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_SEASON_CONFIG_LOCKED',
          message:
            'Ballon season rules are frozen after the season starts.',
        },
      });
    }

    const startAt =
      dto.startAt
        ? new Date(
            dto.startAt,
          )
        : season.startAt;

    const endAt =
      dto.endAt
        ? new Date(
            dto.endAt,
          )
        : season.endAt;

    this.assertValidPeriod(
      startAt,
      endAt,
    );

    const eligibleLeagueIds =
      dto.eligibleLeagueIds
        ? this.uniqueIds(
            dto.eligibleLeagueIds,
          )
        : this.jsonStringArray(
            season.eligibleLeagueIds,
          );

    const eligibleTournamentIds =
      dto.eligibleTournamentIds
        ? this.uniqueIds(
            dto.eligibleTournamentIds,
          )
        : this.jsonStringArray(
            season.eligibleTournamentIds,
          );

    await this.assertCanManageScope(
      userId,
      eligibleLeagueIds,
      eligibleTournamentIds,
    );

    await this.assertScopeExists(
      eligibleLeagueIds,
      eligibleTournamentIds,
    );

    const scoringConfig =
      dto.scoringConfig
        ? this.normalizeScoringConfig(
            dto.scoringConfig,
          )
        : this.normalizeScoringConfig(
            season.scoringConfig as
              Record<string, number>,
          );

    const updated =
      await this.prisma.ballonSeason.update({
        where: {
          id: seasonId,
        },

        data: {
          name:
            dto.name?.trim(),
          startAt,
          endAt,
          minimumMatches:
            dto.minimumMatches,
          rankingLimit:
            dto.rankingLimit,
          eligibleLeagueIds,
          eligibleTournamentIds,
          scoringConfig:
            scoringConfig as any,
        },
      });

    return {
      success: true,
      data: {
        season:
          updated,
      },
      error: null,
    };
  }

  async startSeason(
    userId: string,
    seasonId: string,
  ) {
    const season =
      await this.requireSeason(
        seasonId,
      );

    await this.assertCanManageSeason(
      userId,
      season,
    );

    if (
      season.status ===
      'LIVE'
    ) {
      return {
        success: true,
        data: {
          season,
        },
        error: null,
      };
    }

    if (
      season.status !==
      'DRAFT'
    ) {
      throw this.invalidTransition(
        season.status,
        'LIVE',
      );
    }

    const updated =
      await this.prisma.ballonSeason.update({
        where: {
          id: season.id,
        },

        data: {
          status:
            'LIVE',
          liveAt:
            new Date(),
        },
      });

    return {
      success: true,
      data: {
        season:
          updated,
      },
      error: null,
    };
  }

  async finalizeSeason(
    userId: string,
    seasonId: string,
  ) {
    const season =
      await this.requireSeason(
        seasonId,
      );

    await this.assertCanManageSeason(
      userId,
      season,
    );

    if (
      season.status ===
      'FINALIZING'
    ) {
      return {
        success: true,
        data: {
          season,
        },
        error: null,
      };
    }

    if (
      season.status !==
      'LIVE'
    ) {
      throw this.invalidTransition(
        season.status,
        'FINALIZING',
      );
    }

    if (
      new Date() <
      season.endAt
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_SEASON_NOT_ENDED',
          message:
            'The Ballon period must end before finalization.',
        },
      });
    }

    const updated =
      await this.prisma.ballonSeason.update({
        where: {
          id:
            season.id,
        },

        data: {
          status:
            'FINALIZING',
        },
      });

    return {
      success: true,
      data: {
        season:
          updated,
      },
      error: null,
    };
  }

  async lockSeason(
    userId: string,
    seasonId: string,
  ) {
    const season =
      await this.requireSeason(
        seasonId,
      );

    await this.assertCanManageSeason(
      userId,
      season,
    );

    if (
      season.status ===
        'LOCKED' ||
      season.status ===
        'ARCHIVED'
    ) {
      return this.getSeason(
        userId,
        seasonId,
      );
    }

    if (
      season.status !==
      'FINALIZING'
    ) {
      throw this.invalidTransition(
        season.status,
        'LOCKED',
      );
    }

    /*
     * Recalculate immediately before
     * locking. Final rows are then
     * stored as an immutable snapshot.
     */
    const computed =
      await this.computeRankings(
        season,
      );

    const eligible =
      computed.rows.filter(
        (row) =>
          row.eligible,
      );

    if (
      eligible.length ===
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'NO_ELIGIBLE_BALLON_PLAYERS',
          message:
            'No player meets the Ballon minimum-match requirement.',
        },
      });
    }

    const winner =
      eligible[0];

    const risingStar =
      await this.findRisingStar(
        season,
        eligible,
      );

    await this.prisma.$transaction(
      async (tx) => {
        const latest =
          await tx.ballonSeason.findUnique({
            where: {
              id:
                season.id,
            },
          });

        if (!latest) {
          throw this.seasonNotFound();
        }

        if (
          latest.status ===
            'LOCKED' ||
          latest.status ===
            'ARCHIVED'
        ) {
          return;
        }

        if (
          latest.status !==
          'FINALIZING'
        ) {
          throw this.invalidTransition(
            latest.status,
            'LOCKED',
          );
        }

        await tx.ballonFinalRanking.deleteMany({
          where: {
            seasonId:
              season.id,
          },
        });

        await tx.ballonFinalRanking.createMany({
          data:
            eligible.map(
              (row) => ({
                seasonId:
                  season.id,
                userId:
                  row.userId,
                rank:
                  row.position,
                rating:
                  row.rating,
                breakdown:
                  row.ratingBreakdown as any,
                statistics:
                  this.statisticsSnapshot(
                    row,
                  ) as any,
              }),
            ),
        });

        await tx.seasonalAward.upsert({
          where: {
            userId_seasonId_type: {
              userId:
                winner.userId,
              seasonId:
                season.id,
              type:
                'FC_ARENA_BALLON',
            },
          },

          create: {
            userId:
              winner.userId,
            seasonId:
              season.id,
            type:
              'FC_ARENA_BALLON',
            title:
              'FC Arena Ballon',
            description:
              `${season.name} winner with a ${winner.rating.toFixed(1)} rating.`,
            metadata: {
              rank: 1,
              rating:
                winner.rating,
              breakdown:
                winner.ratingBreakdown,
            } as any,
          },

          update: {
            title:
              'FC Arena Ballon',
            description:
              `${season.name} winner with a ${winner.rating.toFixed(1)} rating.`,
            metadata: {
              rank: 1,
              rating:
                winner.rating,
              breakdown:
                winner.ratingBreakdown,
            } as any,
          },
        });

        if (
          risingStar
        ) {
          await tx.seasonalAward.upsert({
            where: {
              userId_seasonId_type: {
                userId:
                  risingStar.userId,
                seasonId:
                  season.id,
                type:
                  'RISING_STAR',
              },
            },

            create: {
              userId:
                risingStar.userId,
              seasonId:
                season.id,
              type:
                'RISING_STAR',
              title:
                'Rising Star',
              description:
                `Top eligible newcomer in ${season.name} with a ${risingStar.rating.toFixed(1)} rating.`,
              metadata: {
                rank:
                  risingStar.position,
                rating:
                  risingStar.rating,
              } as any,
            },

            update: {
              title:
                'Rising Star',
              description:
                `Top eligible newcomer in ${season.name} with a ${risingStar.rating.toFixed(1)} rating.`,
              metadata: {
                rank:
                  risingStar.position,
                rating:
                  risingStar.rating,
              } as any,
            },
          });
        }

        await tx.ballonSeason.update({
          where: {
            id:
              season.id,
          },

          data: {
            status:
              'LOCKED',
            finalWinnerUserId:
              winner.userId,
            risingStarUserId:
              risingStar
                ?.userId ??
              null,
            lockedAt:
              new Date(),
          },
        });
      },
      {
        isolationLevel:
          'Serializable',
      },
    );

    return this.getSeason(
      userId,
      seasonId,
    );
  }

  async archiveSeason(
    userId: string,
    seasonId: string,
  ) {
    const season =
      await this.requireSeason(
        seasonId,
      );

    await this.assertCanManageSeason(
      userId,
      season,
    );

    if (
      season.status ===
      'ARCHIVED'
    ) {
      return {
        success: true,
        data: {
          season,
        },
        error: null,
      };
    }

    if (
      season.status !==
      'LOCKED'
    ) {
      throw this.invalidTransition(
        season.status,
        'ARCHIVED',
      );
    }

    const updated =
      await this.prisma.ballonSeason.update({
        where: {
          id:
            season.id,
        },

        data: {
          status:
            'ARCHIVED',
          archivedAt:
            new Date(),
        },
      });

    return {
      success: true,
      data: {
        season:
          updated,
      },
      error: null,
    };
  }

  async getSeasons(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const seasons =
      await this.prisma.ballonSeason.findMany({
        where: {
          status: {
            in: [
              'LIVE',
              'LOCKED',
              'ARCHIVED',
            ],
          },
        },

        orderBy: [
          {
            startAt:
              'desc',
          },
          {
            createdAt:
              'desc',
          },
        ],

        take: 50,
      });

    const winnerIds =
      [
        ...new Set(
          seasons
            .flatMap(
              (season) => [
                season.finalWinnerUserId,
                season.risingStarUserId,
              ],
            )
            .filter(
              (
                value,
              ): value is string =>
                typeof value ===
                'string',
            ),
        ),
      ];

    const users =
      await this.usersForIds(
        winnerIds,
      );

    return {
      success: true,
      data: {
        seasons:
          seasons.map(
            (season) => ({
              ...season,
              winner:
                season.finalWinnerUserId
                  ? {
                      userId:
                        season.finalWinnerUserId,
                      ...this.identityFor(
                        users,
                        season.finalWinnerUserId,
                      ),
                    }
                  : null,
              risingStar:
                season.risingStarUserId
                  ? {
                      userId:
                        season.risingStarUserId,
                      ...this.identityFor(
                        users,
                        season.risingStarUserId,
                      ),
                    }
                  : null,
            }),
          ),
      },
      error: null,
    };
  }

  async getAdminSeasons(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          role: true,
        },
      });

    if (!user) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'ADMIN_PERMISSION_REQUIRED',
          message:
            'FC Arena admin permission is required.',
        },
      });
    }

    const seasons =
      await this.prisma.ballonSeason.findMany({
        orderBy: [
          {
            startAt:
              'desc',
          },
          {
            createdAt:
              'desc',
          },
        ],

        take: 50,
      });

    if (
      user.role ===
      'SUPER_ADMIN'
    ) {
      return {
        success: true,
        data: {
          seasons,
        },
        error: null,
      };
    }

    const adminRoles =
      await this.prisma.leagueAdmin.findMany({
        where: {
          userId,
        },

        select: {
          leagueId: true,
        },
      });

    const administered =
      new Set(
        adminRoles.map(
          (role) =>
            role.leagueId,
        ),
      );

    const tournamentIds =
      [
        ...new Set(
          seasons.flatMap(
            (season) =>
              this.jsonStringArray(
                season.eligibleTournamentIds,
              ),
          ),
        ),
      ];

    const tournamentScopes =
      tournamentIds.length > 0
        ? await this.prisma.tournament.findMany({
            where: {
              id: {
                in:
                  tournamentIds,
              },
            },

            select: {
              id: true,
              leagueId: true,
            },
          })
        : [];

    const tournamentLeague =
      new Map(
        tournamentScopes.map(
          (tournament) => [
            tournament.id,
            tournament.leagueId,
          ],
        ),
      );

    const manageable =
      seasons.filter(
        (season) => {
          if (
            season.createdByUserId ===
            userId
          ) {
            return true;
          }

          const required =
            new Set([
              ...this.jsonStringArray(
                season.eligibleLeagueIds,
              ),
              ...this.jsonStringArray(
                season.eligibleTournamentIds,
              )
                .map(
                  (tournamentId) =>
                    tournamentLeague.get(
                      tournamentId,
                    ),
                )
                .filter(
                  (
                    leagueId,
                  ): leagueId is string =>
                    Boolean(
                      leagueId,
                    ),
                ),
            ]);

          return (
            required.size >
              0 &&
            [
              ...required,
            ].every(
              (leagueId) =>
                administered.has(
                  leagueId,
                ),
            )
          );
        },
      );

    return {
      success: true,
      data: {
        seasons:
          manageable,
      },
      error: null,
    };
  }

  async getCurrentSeason(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const season =
      await this.findCurrentSeason();

    if (!season) {
      return {
        success: true,
        data: {
          season: null,
        },
        error: null,
      };
    }

    const rankings =
      await this.getRankingsData(
        season,
        season.rankingLimit,
      );

    return {
      success: true,
      data: {
        season,
        rankings,
      },
      error: null,
    };
  }

  async getSeason(
    userId: string,
    seasonId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const season =
      await this.requireSeason(
        seasonId,
      );

    await this.assertSeasonVisible(
      userId,
      season,
    );

    const rankings =
      await this.getRankingsData(
        season,
        season.rankingLimit,
      );

    return {
      success: true,
      data: {
        season,
        rankings,
      },
      error: null,
    };
  }

  async getRankings(
    userId: string,
    seasonId: string,
    rawLimit?: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const season =
      await this.requireSeason(
        seasonId,
      );

    await this.assertSeasonVisible(
      userId,
      season,
    );

    const requested =
      Number(
        rawLimit,
      );

    const limit =
      [10, 20, 50].includes(
        requested,
      )
        ? requested
        : season.rankingLimit;

    const rankings =
      await this.getRankingsData(
        season,
        limit,
      );

    return {
      success: true,
      data: {
        season,
        ...rankings,
      },
      error: null,
    };
  }

  async getMyRanking(
    userId: string,
    seasonId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const season =
      await this.requireSeason(
        seasonId,
      );

    await this.assertSeasonVisible(
      userId,
      season,
    );

    const rankings =
      await this.getRankingsData(
        season,
        50,
      );

    return {
      success: true,
      data: {
        season,
        ranking:
          rankings.rows.find(
            (row: any) =>
              row.userId ===
              userId,
          ) ??
          null,
      },
      error: null,
    };
  }

  async getPlayerRanking(
    requesterUserId: string,
    seasonId: string,
    playerUserId: string,
  ) {
    await this.assertActiveUser(
      requesterUserId,
    );

    const season =
      await this.requireSeason(
        seasonId,
      );

    await this.assertSeasonVisible(
      requesterUserId,
      season,
    );

    const rankings =
      await this.getRankingsData(
        season,
        50,
      );

    const ranking =
      rankings.rows.find(
        (row: any) =>
          row.userId ===
          playerUserId,
      ) ??
      null;

    if (!ranking) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_PLAYER_NOT_RANKED',
          message:
            'This player is not ranked in the selected Ballon season.',
        },
      });
    }

    return {
      success: true,
      data: {
        season,
        ranking,
      },
      error: null,
    };
  }

  async getAwardsOverview(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const [
      season,
      achievements,
      seasonalAwards,
      recentSeasonalAwards,
    ] =
      await Promise.all([
        this.findCurrentSeason(),

        this.prisma.achievement.findMany({
          where: {
            userId,
          },

          orderBy: {
            awardedAt:
              'desc',
          },

          take: 100,
        }),

        this.prisma.seasonalAward.findMany({
          where: {
            userId,
          },

          orderBy: {
            awardedAt:
              'desc',
          },

          take: 100,
        }),

        this.prisma.seasonalAward.findMany({
          orderBy: {
            awardedAt:
              'desc',
          },

          take: 12,
        }),
      ]);

    const recentUserIds =
      [
        ...new Set(
          recentSeasonalAwards.map(
            (award) =>
              award.userId,
          ),
        ),
      ];

    const recentUsers =
      recentUserIds.length > 0
        ? await this.prisma.user.findMany({
            where: {
              id: {
                in:
                  recentUserIds,
              },
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
            },
          })
        : [];

    const recentUserMap =
      new Map(
        recentUsers.map(
          (user) => [
            user.id,
            user,
          ],
        ),
      );

    const tournamentCounts =
      achievements.reduce(
        (
          counts:
            Record<
              string,
              number
            >,
          achievement,
        ) => {
          const publicType =
            achievement.type ===
            'BEST_PLAYER'
              ? 'PLAYER_OF_TOURNAMENT'
              : achievement.type;

          counts[publicType] =
            (
              counts[
                publicType
              ] ??
              0
            ) + 1;

          return counts;
        },
        {},
      );

    const seasonalCounts =
      seasonalAwards.reduce(
        (
          counts:
            Record<
              string,
              number
            >,
          award,
        ) => {
          counts[award.type] =
            (
              counts[
                award.type
              ] ??
              0
            ) + 1;

          return counts;
        },
        {},
      );

    const currentRankings =
      season
        ? await this.getRankingsData(
            season,
            Math.min(
              10,
              season.rankingLimit,
            ),
          )
        : null;

    const memberships =
      await this.prisma.leagueMember.findMany({
        where: {
          userId,
        },

        select: {
          leagueId: true,
        },
      });

    const memberLeagueIds =
      memberships.map(
        (membership) =>
          membership.leagueId,
      );

    const activeAwardTournaments =
      memberLeagueIds.length >
      0
        ? await this.prisma.tournament.findMany({
            where: {
              leagueId: {
                in:
                  memberLeagueIds,
              },

              mode:
                'SOLO',

              status: {
                in: [
                  'REGISTRATION_CLOSED',
                  'ACTIVE',
                ],
              },
            },

            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              startAt: true,

              league: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },

            orderBy: {
              updatedAt:
                'desc',
            },

            take: 6,
          })
        : [];

    return {
      success: true,

      data: {
        currentBallon:
          season
            ? {
                season,
                rankings:
                  currentRankings,
              }
            : null,

        trophyCabinet: {
          ...tournamentCounts,
          ...seasonalCounts,
        },

        myTournamentAwards:
          achievements,

        mySeasonalAwards:
          seasonalAwards,

        activeAwardTournaments,

        recentSeasonalWinners:
          recentSeasonalAwards.map(
            (award) => {
              const user =
                recentUserMap.get(
                  award.userId,
                );

              return {
                ...award,
                player: {
                  fullName:
                    user
                      ?.fullName ??
                    'Player',
                  inGameName:
                    user
                      ?.player
                      ?.identity
                      ?.inGameName ??
                    null,
                  playerCode:
                    user
                      ?.player
                      ?.playerCode ??
                    null,
                  profileImageUrl:
                    user
                      ?.player
                      ?.profileImageUrl ??
                    null,
                },
              };
            },
          ),
      },

      error: null,
    };
  }

  private async getRankingsData(
    season: any,
    limit: number,
  ) {
    if (
      season.status ===
        'LOCKED' ||
      season.status ===
        'ARCHIVED'
    ) {
      const finalRows =
        await this.prisma.ballonFinalRanking.findMany({
          where: {
            seasonId:
              season.id,
          },

          orderBy: {
            rank:
              'asc',
          },

          take:
            limit,
        });

      const users =
        await this.usersForIds(
          finalRows.map(
            (row) =>
              row.userId,
          ),
        );

      return {
        locked: true,
        rows:
          finalRows.map(
            (row) => ({
              position:
                row.rank,
              userId:
                row.userId,
              ...this.identityFor(
                users,
                row.userId,
              ),
              rating:
                row.rating,
              ratingBreakdown:
                row.breakdown,
              statistics:
                row.statistics,
              previousPosition:
                null,
              rankChange:
                null,
              eligible: true,
            }),
          ),
      };
    }

    const computed =
      await this.computeRankings(
        season,
      );

    await this.captureDailySnapshot(
      season,
      computed.rows,
    );

    const movement =
      await this.previousPositions(
        season.id,
      );

    return {
      locked: false,
      rows:
        computed.rows
          .slice(
            0,
            limit,
          )
          .map(
            (row) => {
              const previous =
                movement.get(
                  row.userId,
                );

              return {
                ...row,
                previousPosition:
                  previous ??
                  null,
                rankChange:
                  typeof previous ===
                    'number'
                    ? previous -
                      row.position
                    : null,
              };
            },
          ),
    };
  }

  private async computeRankings(
    season: any,
  ) {
    const leagueIds =
      this.jsonStringArray(
        season.eligibleLeagueIds,
      );

    const tournamentIds =
      this.jsonStringArray(
        season.eligibleTournamentIds,
      );

    const scopeOr:
      Record<
        string,
        unknown
      >[] = [];

    if (
      leagueIds.length >
      0
    ) {
      scopeOr.push({
        leagueId: {
          in:
            leagueIds,
        },
      });
    }

    if (
      tournamentIds.length >
      0
    ) {
      scopeOr.push({
        id: {
          in:
            tournamentIds,
        },
      });
    }

    const tournaments =
      await this.prisma.tournament.findMany({
        where: {
          mode:
            'SOLO',

          status: {
            not:
              'CANCELLED',
          },

          ...(scopeOr.length >
          0
            ? {
                OR:
                  scopeOr,
              }
            : {}),
        },

        select: {
          id: true,
          name: true,
          leagueId: true,
          competitionFormat:
            true,
          legType: true,
        },
      });

    const allowedTournamentIds =
      tournaments.map(
        (tournament) =>
          tournament.id,
      );

    if (
      allowedTournamentIds.length ===
      0
    ) {
      return {
        rows:
          [] as LiveRankingRow[],
      };
    }

    const tournamentMap =
      new Map(
        tournaments.map(
          (tournament) => [
            tournament.id,
            tournament,
          ],
        ),
      );

    const rawMatches =
      await this.prisma.match.findMany({
        where: {
          tournamentId: {
            in:
              allowedTournamentIds,
          },

          confirmedResultSubmissionId: {
            not: null,
          },
        },

        include: {
          confirmedResult:
            true,

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
              },
            },
          },
        },
      });

    const endBoundary =
      season.status ===
        'LIVE'
        ? new Date(
            Math.min(
              Date.now(),
              season.endAt.getTime(),
            ),
          )
        : season.endAt;

    const inWindow =
      rawMatches.filter(
        (match) => {
          const result =
            match.confirmedResult;

          if (!result) {
            return false;
          }

          const eventAt =
            result.reviewedAt ??
            result.updatedAt;

          return (
            eventAt >=
              season.startAt &&
            eventAt <=
              endBoundary
          );
        },
      );

    const byTournament =
      new Map<
        string,
        any[]
      >();

    for (
      const match
      of inWindow
    ) {
      const collection =
        byTournament.get(
          match.tournamentId,
        ) ??
        [];

      collection.push(
        match,
      );

      byTournament.set(
        match.tournamentId,
        collection,
      );
    }

    const canonical:
      any[] = [];

    for (
      const [
        tournamentId,
        matches,
      ] of byTournament.entries()
    ) {
      const tournament =
        tournamentMap.get(
          tournamentId,
        );

      if (!tournament) {
        continue;
      }

      const deduplicated =
        deduplicateFixtureRecords(
          matches
            .map(
              (match: any) => ({
                ...match.fixture,

                match: {
                  status:
                    match.status,

                  confirmedResultSubmissionId:
                    match.confirmedResultSubmissionId,

                  confirmedResult:
                    match.confirmedResult
                      ? {
                          id:
                            match.confirmedResult.id,

                          status:
                            match.confirmedResult.status,
                        }
                      : null,
                },

                sourceMatch:
                  match,
              }),
            )
            .filter(
              isCanonicalCompletedFixture,
            ),
          tournament.competitionFormat,
          tournament.legType,
        ).map(
          (fixture: any) =>
            fixture.sourceMatch,
        );

      canonical.push(
        ...deduplicated,
      );
    }

    canonical.sort(
      (
        first,
        second,
      ) => {
        const firstAt =
          first.confirmedResult
            ?.reviewedAt ??
          first.confirmedResult
            ?.updatedAt ??
          first.updatedAt;

        const secondAt =
          second.confirmedResult
            ?.reviewedAt ??
          second.confirmedResult
            ?.updatedAt ??
          second.updatedAt;

        return (
          firstAt.getTime() -
            secondAt.getTime() ||
          first.fixture.sequence -
            second.fixture.sequence
        );
      },
    );

    const aggregates =
      new Map<
        string,
        SeasonStats
      >();

    const identities =
      new Map<
        string,
        PlayerIdentity
      >();

    const tournamentSets =
      new Map<
        string,
        Set<string>
      >();

    const currentStreak =
      new Map<
        string,
        number
      >();

    const ensure = (
      member: any,
    ) => {
      const userId =
        member.userId;

      if (
        !aggregates.has(
          userId,
        )
      ) {
        aggregates.set(
          userId,
          {
            userId,
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            cleanSheets: 0,
            bigMatchPoints: 0,
            longestWinStreak: 0,
            tournamentsPlayed: 0,
            tournamentTitles: 0,
            firstCompetitiveAt:
              null,
          },
        );
      }

      identities.set(
        userId,
        {
          fullName:
            member.user
              .fullName,
          inGameName:
            member.user
              .player
              ?.identity
              ?.inGameName ??
            null,
          playerCode:
            member.user
              .player
              ?.playerCode ??
            null,
          profileImageUrl:
            member.user
              .player
              ?.profileImageUrl ??
            null,
        },
      );

      if (
        !tournamentSets.has(
          userId,
        )
      ) {
        tournamentSets.set(
          userId,
          new Set(),
        );
      }

      return aggregates.get(
        userId,
      )!;
    };

    const apply = (
      member: any,
      tournamentId: string,
      goalsFor: number,
      goalsAgainst: number,
      won: boolean,
      draw: boolean,
      roundName: string,
      eventAt: Date,
    ) => {
      const aggregate =
        ensure(
          member,
        );

      if (
        !aggregate.firstCompetitiveAt ||
        eventAt <
          new Date(
            aggregate.firstCompetitiveAt,
          )
      ) {
        aggregate.firstCompetitiveAt =
          eventAt.toISOString();
      }

      aggregate.matches +=
        1;

      aggregate.goalsFor +=
        goalsFor;

      aggregate.goalsAgainst +=
        goalsAgainst;

      aggregate.goalDifference =
        aggregate.goalsFor -
        aggregate.goalsAgainst;

      if (won) {
        aggregate.wins +=
          1;
      } else if (draw) {
        aggregate.draws +=
          1;
      } else {
        aggregate.losses +=
          1;
      }

      if (
        goalsAgainst ===
        0
      ) {
        aggregate.cleanSheets +=
          1;
      }

      const normalizedRound =
        roundName.toLowerCase();

      if (won) {
        if (
          normalizedRound.includes(
            'quarter',
          ) ||
          normalizedRound ===
            'qf'
        ) {
          aggregate.bigMatchPoints +=
            0.5;
        } else if (
          normalizedRound.includes(
            'semi',
          ) ||
          normalizedRound ===
            'sf'
        ) {
          aggregate.bigMatchPoints +=
            1;
        } else if (
          normalizedRound.includes(
            'final',
          )
        ) {
          aggregate.bigMatchPoints +=
            2;
        }
      }

      const nextStreak =
        won
          ? (
              currentStreak.get(
                aggregate.userId,
              ) ??
              0
            ) + 1
          : 0;

      currentStreak.set(
        aggregate.userId,
        nextStreak,
      );

      aggregate.longestWinStreak =
        Math.max(
          aggregate.longestWinStreak,
          nextStreak,
        );

      tournamentSets
        .get(
          aggregate.userId,
        )
        ?.add(
          tournamentId,
        );
    };

    for (
      const match
      of canonical
    ) {
      const result =
        match.confirmedResult;

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

      /*
       * V1 individual Ballon metrics
       * are SOLO-only. Skip malformed
       * entries rather than attributing
       * a team score to every member.
       */
      if (
        !result ||
        homeMembers.length !==
          1 ||
        awayMembers.length !==
          1
      ) {
        continue;
      }

      const homeWon =
        result.homeScore >
        result.awayScore;

      const awayWon =
        result.awayScore >
        result.homeScore;

      const draw =
        result.homeScore ===
        result.awayScore;

      const eventAt =
        result.reviewedAt ??
        result.updatedAt;

      apply(
        homeMembers[0],
        match.tournamentId,
        result.homeScore,
        result.awayScore,
        homeWon,
        draw,
        match.fixture
          .roundName ??
          '',
        eventAt,
      );

      apply(
        awayMembers[0],
        match.tournamentId,
        result.awayScore,
        result.homeScore,
        awayWon,
        draw,
        match.fixture
          .roundName ??
          '',
        eventAt,
      );
    }

    for (
      const [
        userId,
        set,
      ] of tournamentSets.entries()
    ) {
      const aggregate =
        aggregates.get(
          userId,
        );

      if (aggregate) {
        aggregate.tournamentsPlayed =
          set.size;
      }
    }

    const userIds =
      [
        ...aggregates.keys(),
      ];

    if (
      userIds.length ===
      0
    ) {
      return {
        rows:
          [] as LiveRankingRow[],
      };
    }

    const [
      placements,
      previousBallonAwards,
    ] =
      await Promise.all([
        this.prisma.achievement.findMany({
          where: {
            userId: {
              in:
                userIds,
            },

            tournamentId: {
              in:
                allowedTournamentIds,
            },

            type: {
              in: [
                'TOURNAMENT_CHAMPION',
                'TOURNAMENT_RUNNER_UP',
              ],
            },

            awardedAt: {
              gte:
                season.startAt,
              lte:
                endBoundary,
            },
          },

          select: {
            userId: true,
            type: true,
          },
        }),

        this.prisma.seasonalAward.findMany({
          where: {
            userId: {
              in:
                userIds,
            },

            type:
              'FC_ARENA_BALLON',

            seasonId: {
              not:
                season.id,
            },
          },

          select: {
            userId: true,
          },
        }),
      ]);

    for (
      const placement
      of placements
    ) {
      const aggregate =
        aggregates.get(
          placement.userId,
        );

      if (!aggregate) {
        continue;
      }

      if (
        placement.type ===
        'TOURNAMENT_CHAMPION'
      ) {
        aggregate.bigMatchPoints +=
          3;

        aggregate.tournamentTitles +=
          1;
      } else {
        aggregate.bigMatchPoints +=
          1;
      }
    }

    const weights =
      this.normalizeScoringConfig(
        season.scoringConfig as
          Record<
            string,
            number
          >,
      );

    const rated =
      calculatePerformanceRatings(
        [
          ...aggregates.values(),
        ],
        weights,
      );

    const previousBallonWinners =
      new Set(
        previousBallonAwards.map(
          (award) =>
            award.userId,
        ),
      );

    const provisional =
      rated.map(
        (
          row,
          index,
        ) => {
          const identity =
            identities.get(
              row.userId,
            ) ??
            {
              fullName:
                'Player',
              inGameName:
                null,
              playerCode:
                null,
              profileImageUrl:
                null,
            };

          const stats =
            aggregates.get(
              row.userId,
            )!;

          return {
            position:
              index + 1,
            ...identity,
            ...stats,
            rating:
              row.rating,
            ratingBreakdown:
              row.ratingBreakdown,
            eligible:
              row.matches >=
              season.minimumMatches,
            previousBallonWinner:
              previousBallonWinners.has(
                row.userId,
              ),
          };
        },
      );

    /*
     * Eligible players are ranked first.
     * Ineligible players remain visible
     * as "Not Yet Eligible" but cannot
     * displace qualified players.
     */
    const sorted =
      provisional.sort(
        (
          first,
          second,
        ) =>
          Number(
            second.eligible,
          ) -
            Number(
              first.eligible,
            ) ||
          second.rating -
            first.rating ||
          second.wins -
            first.wins ||
          second.goalDifference -
            first.goalDifference ||
          second.goalsFor -
            first.goalsFor ||
          first.userId.localeCompare(
            second.userId,
          ),
      );

    return {
      rows:
        sorted.map(
          (
            row,
            index,
          ) => ({
            ...row,
            position:
              index + 1,
            previousPosition:
              null,
            rankChange:
              null,
          }),
        ),
    };
  }

  private async findRisingStar(
    season: any,
    rows: any[],
  ) {
    const windowStart =
      new Date(
        season.startAt.getTime() -
          90 *
            24 *
            60 *
            60 *
            1000,
      );

    return (
      rows.find(
        (row) => {
          if (
            row.previousBallonWinner
          ) {
            return false;
          }

          if (
            !row.firstCompetitiveAt
          ) {
            return false;
          }

          const first =
            new Date(
              row.firstCompetitiveAt,
            );

          return (
            first >=
              windowStart &&
            first <=
              season.endAt
          );
        },
      ) ??
      null
    );
  }

  private async captureDailySnapshot(
    season: any,
    rows: any[],
  ) {
    if (
      season.status !==
      'LIVE'
    ) {
      return;
    }

    const day =
      new Date();

    day.setUTCHours(
      0,
      0,
      0,
      0,
    );

    await this.prisma.ballonRankingSnapshot.upsert({
      where: {
        seasonId_day: {
          seasonId:
            season.id,
          day,
        },
      },

      create: {
        seasonId:
          season.id,
        day,
        rows:
          rows
            .slice(
              0,
              season.rankingLimit,
            )
            .map(
              (row) => ({
                userId:
                  row.userId,
                position:
                  row.position,
                rating:
                  row.rating,
              }),
            ),
      },

      update: {},
    });
  }

  private async previousPositions(
    seasonId: string,
  ) {
    const today =
      new Date();

    today.setUTCHours(
      0,
      0,
      0,
      0,
    );

    const previous =
      await this.prisma.ballonRankingSnapshot.findFirst({
        where: {
          seasonId,

          day: {
            lt:
              today,
          },
        },

        orderBy: {
          day:
            'desc',
        },
      });

    const rows =
      Array.isArray(
        previous?.rows,
      )
        ? previous.rows
        : [];

    const movement =
      new Map<
        string,
        number
      >();

    for (
      const row
      of rows as any[]
    ) {
      if (
        typeof row?.userId ===
          'string' &&
        typeof row?.position ===
          'number'
      ) {
        movement.set(
          row.userId,
          row.position,
        );
      }
    }

    return movement;
  }

  private async usersForIds(
    userIds: string[],
  ) {
    if (
      userIds.length ===
      0
    ) {
      return new Map<
        string,
        any
      >();
    }

    const users =
      await this.prisma.user.findMany({
        where: {
          id: {
            in:
              userIds,
          },
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
        },
      });

    return new Map(
      users.map(
        (user) => [
          user.id,
          user,
        ],
      ),
    );
  }

  private identityFor(
    users: Map<
      string,
      any
    >,
    userId: string,
  ): PlayerIdentity {
    const user =
      users.get(
        userId,
      );

    return {
      fullName:
        user?.fullName ??
        'Player',
      inGameName:
        user?.player
          ?.identity
          ?.inGameName ??
        null,
      playerCode:
        user?.player
          ?.playerCode ??
        null,
      profileImageUrl:
        user?.player
          ?.profileImageUrl ??
        null,
    };
  }

  private statisticsSnapshot(
    row: any,
  ) {
    return {
      matches:
        row.matches,
      wins:
        row.wins,
      draws:
        row.draws,
      losses:
        row.losses,
      goalsFor:
        row.goalsFor,
      goalsAgainst:
        row.goalsAgainst,
      goalDifference:
        row.goalDifference,
      cleanSheets:
        row.cleanSheets,
      tournamentsPlayed:
        row.tournamentsPlayed,
      tournamentTitles:
        row.tournamentTitles,
      longestWinStreak:
        row.longestWinStreak,
      firstCompetitiveAt:
        row.firstCompetitiveAt,
    };
  }

  private async findCurrentSeason() {
    const now =
      new Date();

    const live =
      await this.prisma.ballonSeason.findFirst({
        where: {
          status:
            'LIVE',

          startAt: {
            lte:
              now,
          },

          endAt: {
            gte:
              now,
          },
        },

        orderBy: {
          startAt:
            'desc',
        },
      });

    if (live) {
      return live;
    }

    return this.prisma.ballonSeason.findFirst({
      where: {
        status: {
          in: [
            'LOCKED',
            'ARCHIVED',
          ],
        },
      },

      orderBy: {
        endAt:
          'desc',
      },
    });
  }

  private async requireSeason(
    seasonId: string,
  ) {
    const season =
      await this.prisma.ballonSeason.findUnique({
        where: {
          id:
            seasonId,
        },
      });

    if (!season) {
      throw this.seasonNotFound();
    }

    return season;
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
            'ACTIVE_ACCOUNT_REQUIRED',
          message:
            'An active FC Arena account is required.',
        },
      });
    }
  }

  private async assertSeasonVisible(
    userId: string,
    season: any,
  ) {
    if (
      [
        'LIVE',
        'LOCKED',
        'ARCHIVED',
      ].includes(
        season.status,
      )
    ) {
      return;
    }

    await this.assertCanManageSeason(
      userId,
      season,
    );
  }

  private async assertCanManageSeason(
    userId: string,
    season: any,
  ) {
    await this.assertCanManageScope(
      userId,
      this.jsonStringArray(
        season.eligibleLeagueIds,
      ),
      this.jsonStringArray(
        season.eligibleTournamentIds,
      ),
    );
  }

  private async assertCanManageScope(
    userId: string,
    leagueIds: string[],
    tournamentIds: string[],
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          role: true,
        },
      });

    if (!user) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'ADMIN_PERMISSION_REQUIRED',
          message:
            'FC Arena admin permission is required.',
        },
      });
    }

    if (
      user.role ===
      'SUPER_ADMIN'
    ) {
      return;
    }

    const tournamentLeagues =
      tournamentIds.length >
      0
        ? await this.prisma.tournament.findMany({
            where: {
              id: {
                in:
                  tournamentIds,
              },
            },

            select: {
              leagueId:
                true,
            },
          })
        : [];

    const requiredLeagueIds =
      [
        ...new Set([
          ...leagueIds,
          ...tournamentLeagues.map(
            (tournament) =>
              tournament.leagueId,
          ),
        ]),
      ];

    if (
      requiredLeagueIds.length ===
      0
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'GLOBAL_BALLON_ADMIN_REQUIRED',
          message:
            'Only a Super Admin may manage a global Ballon season.',
        },
      });
    }

    const adminRoles =
      await this.prisma.leagueAdmin.findMany({
        where: {
          userId,

          leagueId: {
            in:
              requiredLeagueIds,
          },
        },

        select: {
          leagueId: true,
        },
      });

    const administered =
      new Set(
        adminRoles.map(
          (role) =>
            role.leagueId,
        ),
      );

    const missing =
      requiredLeagueIds.filter(
        (leagueId) =>
          !administered.has(
            leagueId,
          ),
      );

    if (
      missing.length >
      0
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_SCOPE_ADMIN_REQUIRED',
          message:
            'You must administer every selected League or Tournament scope.',
        },
      });
    }
  }

  private async assertScopeExists(
    leagueIds: string[],
    tournamentIds: string[],
  ) {
    const [
      leagueCount,
      tournaments,
    ] =
      await Promise.all([
        leagueIds.length >
        0
          ? this.prisma.league.count({
              where: {
                id: {
                  in:
                    leagueIds,
                },
              },
            })
          : Promise.resolve(
              0,
            ),

        tournamentIds.length >
        0
          ? this.prisma.tournament.findMany({
              where: {
                id: {
                  in:
                    tournamentIds,
                },
              },

              select: {
                id: true,
                mode: true,
              },
            })
          : Promise.resolve(
              [] as {
                id: string;
                mode: string;
              }[],
            ),
      ]);

    if (
      leagueCount !==
      leagueIds.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_LEAGUE_SCOPE_INVALID',
          message:
            'One or more selected Ballon leagues do not exist.',
        },
      });
    }

    if (
      tournaments.length !==
      tournamentIds.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_TOURNAMENT_SCOPE_INVALID',
          message:
            'One or more selected Ballon tournaments do not exist.',
        },
      });
    }

    if (
      tournaments.some(
        (tournament) =>
          tournament.mode !==
          'SOLO',
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_SOLO_ONLY_V1',
          message:
            'FC Arena Ballon V1 only accepts SOLO tournaments because team-level scores cannot be safely assigned to individual players.',
        },
      });
    }
  }

  private normalizeScoringConfig(
    input?:
      Record<
        string,
        number
      > | null,
  ): RatingWeights {
    const allowed =
      [
        'matchPerformance',
        'attack',
        'defence',
        'goalDifference',
        'bigMatches',
        'consistency',
      ] as const;

    const merged:
      RatingWeights = {
        ...DEFAULT_RATING_WEIGHTS,
        ...(input ??
          {}),
      };

    for (
      const key
      of allowed
    ) {
      const value =
        merged[key];

      if (
        typeof value !==
          'number' ||
        !Number.isFinite(
          value,
        ) ||
        value < 0 ||
        value > 100
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'BALLON_SCORING_CONFIG_INVALID',
            message:
              'Ballon scoring weights must be finite values between 0 and 100.',
          },
        });
      }
    }

    const total =
      allowed.reduce(
        (
          sum,
          key,
        ) =>
          sum +
          merged[key],
        0,
      );

    if (
      Math.abs(
        total -
          100,
      ) >
      0.001
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_SCORING_TOTAL_INVALID',
          message:
            'Ballon scoring weights must total exactly 100.',
        },
      });
    }

    return merged;
  }

  private defaultMinimumMatches(
    startAt: Date,
    endAt: Date,
  ) {
    const days =
      (
        endAt.getTime() -
        startAt.getTime()
      ) /
      (
        24 *
        60 *
        60 *
        1000
      );

    if (
      days <= 35
    ) {
      return 6;
    }

    if (
      days <= 65
    ) {
      return 10;
    }

    return 15;
  }

  private assertValidPeriod(
    startAt: Date,
    endAt: Date,
  ) {
    if (
      Number.isNaN(
        startAt.getTime(),
      ) ||
      Number.isNaN(
        endAt.getTime(),
      ) ||
      endAt <=
        startAt
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_PERIOD_INVALID',
          message:
            'Ballon season end date must be after its start date.',
        },
      });
    }
  }

  private jsonStringArray(
    value: unknown,
  ) {
    return Array.isArray(
      value,
    )
      ? value.filter(
          (
            item,
          ): item is string =>
            typeof item ===
            'string',
        )
      : [];
  }

  private uniqueIds(
    value?: string[],
  ) {
    return [
      ...new Set(
        value ??
          [],
      ),
    ];
  }

  private invalidTransition(
    current: string,
    next: string,
  ) {
    return new ConflictException({
      success: false,
      data: null,
      error: {
        code:
          'BALLON_SEASON_TRANSITION_INVALID',
        message:
          `Cannot move Ballon season from ${current} to ${next}.`,
      },
    });
  }

  private seasonNotFound() {
    return new NotFoundException({
      success: false,
      data: null,
      error: {
        code:
          'BALLON_SEASON_NOT_FOUND',
        message:
          'FC Arena Ballon season could not be found.',
      },
    });
  }
}
