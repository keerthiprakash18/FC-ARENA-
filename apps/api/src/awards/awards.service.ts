import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import {
  deduplicateFixtureRecords,
  isCanonicalCompletedFixture,
} from '../tournaments/fixture-deduplication.js';

import {
  scoreAwardCandidates,
  sortGoldenBoot,
  sortGoldenGlove,
  sortPlayerOfTournament,
} from './award-rating.js';

import type {
  CreateBallonSeasonDto,
} from './dto/create-ballon-season.dto.js';

type Aggregate = {
  userId: string;
  displayName: string;
  fullName: string;
  playerCode: string | null;
  profileImageUrl: string | null;
  joinedAt: Date;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  goalDifference: number;
  currentWinningStreak: number;
  maxWinningStreak: number;
  bigMatchRaw: number;
};

type RankedCandidate =
  ReturnType<
    typeof scoreAwardCandidates<
      Aggregate
    >
  >[number] & {
    displayName: string;
    fullName: string;
    playerCode: string | null;
    profileImageUrl: string | null;
    goalDifference: number;
    eligible?: boolean;
    risingStarEligible?: boolean;
    rank?: number;
    movement?: number;
  };

@Injectable()
export class AwardsService {
  constructor(
    private readonly prisma:
      PrismaService,
    private readonly authorization:
      AuthorizationService,
  ) {}

  async getTournamentAwardRace(
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
          name: true,
          leagueId: true,
          mode: true,
          format: true,
          competitionFormat: true,
          legType: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMemberOrAdmin(
      userId,
      tournament.leagueId,
    );

    if (
      tournament.mode !==
      'SOLO'
    ) {
      return {
        success: true,
        data: {
          tournament: {
            id:
              tournament.id,
            name:
              tournament.name,
            mode:
              tournament.mode,
          },
          individualAwardsSupported:
            false,
          reason:
            'Golden Boot, Golden Glove and Player of the Tournament are calculated automatically for SOLO tournaments in Awards V1.',
          goldenBoot: [],
          goldenGlove: [],
          playerOfTheTournament:
            [],
        },
        error: null,
      };
    }

    const aggregates =
      await this.aggregateTournament(
        tournamentId,
        tournament.competitionFormat,
        tournament.legType,
      );

    const rated =
      scoreAwardCandidates(
        [...aggregates.values()].filter(
          (candidate) =>
            candidate.matches >
            0,
        ),
      ).map(
        (candidate) => ({
          ...candidate,
          goalDifference:
            candidate.goalsFor -
            candidate.goalsAgainst,
        }),
      );

    const goldenBoot =
      sortGoldenBoot(
        rated.map(
          (
            candidate,
          ) => ({
            ...candidate,
            displayName:
              candidate.displayName,
          }),
        ),
      );

    const goldenGlove =
      sortGoldenGlove(
        rated.map(
          (
            candidate,
          ) => ({
            ...candidate,
            displayName:
              candidate.displayName,
          }),
        ),
      );

    const playerOfTheTournament =
      sortPlayerOfTournament(
        rated.map(
          (
            candidate,
          ) => ({
            ...candidate,
            displayName:
              candidate.displayName,
          }),
        ),
      );

    return {
      success: true,
      data: {
        tournament: {
          id:
            tournament.id,
          name:
            tournament.name,
          mode:
            tournament.mode,
        },
        individualAwardsSupported:
          true,
        criteria: {
          goldenBoot:
            'Goals, then goals per match, goal difference, wins, then name.',
          goldenGlove:
            'Clean sheets, clean-sheet rate, lower goals conceded per match, matches played, lower total goals conceded, then name.',
          playerOfTheTournament:
            '100-point rating: Match Performance 30, Attack 20, Defence 15, Goal Difference 15, Big Matches 15, Consistency 5.',
        },
        goldenBoot,
        goldenGlove,
        playerOfTheTournament,
      },
      error: null,
    };
  }

  async listBallonSeasons(
    userId: string,
  ) {
    const seasons =
      await this.prisma.ballonSeason.findMany({
        include: {
          league: {
            select: {
              id: true,
              name: true,
            },
          },
          winner: {
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
          },
          risingStarWinner: {
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
          },
          tournaments: {
            include: {
              tournament: {
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
          startAt: 'desc',
        },
        take: 50,
      });

    const superAdmin =
      await this.authorization.isSuperAdmin(
        userId,
      );

    const adminLeagueIds =
      new Set(
        (
          await this.prisma.leagueAdmin.findMany({
            where: {
              userId,
            },
            select: {
              leagueId: true,
            },
          })
        ).map(
          (row) =>
            row.leagueId,
        ),
      );

    return {
      success: true,
      data: {
        seasons:
          seasons.map(
            (season) => ({
              ...season,
              canManage:
                superAdmin ||
                (
                  Boolean(
                    season.leagueId,
                  ) &&
                  adminLeagueIds.has(
                    season.leagueId!,
                  )
                ),
            }),
      },
      error: null,
    };
  }

  async getCurrentBallonSeason(
    userId: string,
  ) {
    const now =
      new Date();

    const season =
      await this.prisma.ballonSeason.findFirst({
        where: {
          status: 'LIVE',
          startAt: {
            lte: now,
          },
          endAt: {
            gte: now,
          },
        },
        orderBy: {
          startAt: 'desc',
        },
      });

    if (!season) {
      return {
        success: true,
        data: {
          season: null,
          rankings: [],
          myRank: null,
        },
        error: null,
      };
    }

    return this.getBallonSeasonRankings(
      userId,
      season.id,
    );
  }

  async getBallonSeasonRankings(
    userId: string,
    seasonId: string,
  ) {
    const season =
      await this.prisma.ballonSeason.findUnique({
        where: {
          id: seasonId,
        },
        include: {
          league: {
            select: {
              id: true,
              name: true,
            },
          },
          tournaments: {
            select: {
              tournamentId: true,
              tournament: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          winner: {
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
          },
          risingStarWinner: {
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
          },
        },
      });

    if (!season) {
      throw this.ballonSeasonNotFound();
    }

    const ranking =
      await this.computeBallonRanking(
        season,
      );

    const today =
      this.utcDateOnly(
        new Date(),
      );

    const previous =
      await this.prisma.ballonRankingSnapshot.findFirst({
        where: {
          seasonId,
          day: {
            lt: today,
          },
        },
        orderBy: {
          day: 'desc',
        },
      });

    const previousPositions =
      new Map<
        string,
        number
      >();

    if (
      Array.isArray(
        previous?.positions,
      )
    ) {
      for (
        const entry
        of previous!.positions as Array<any>
      ) {
        if (
          typeof entry?.userId ===
            'string' &&
          typeof entry?.rank ===
            'number'
        ) {
          previousPositions.set(
            entry.userId,
            entry.rank,
          );
        }
      }
    }

    const rankings =
      ranking
        .slice(
          0,
          season.rankingSize,
        )
        .map(
          (
            candidate,
            index,
          ) => {
            const rank =
              index + 1;

            const previousRank =
              previousPositions.get(
                candidate.userId,
              );

            return {
              ...candidate,
              rank,
              movement:
                previousRank
                  ? previousRank -
                    rank
                  : 0,
            };
          },
        );

    if (
      season.status ===
      'LIVE'
    ) {
      await this.prisma.ballonRankingSnapshot.upsert({
        where: {
          seasonId_day: {
            seasonId,
            day: today,
          },
        },
        create: {
          seasonId,
          day: today,
          positions:
            rankings.map(
              (
                candidate,
              ) => ({
                userId:
                  candidate.userId,
                rank:
                  candidate.rank,
                rating:
                  candidate.rating,
              }),
            ),
        },
        update: {
          capturedAt:
            new Date(),
          positions:
            rankings.map(
              (
                candidate,
              ) => ({
                userId:
                  candidate.userId,
                rank:
                  candidate.rank,
                rating:
                  candidate.rating,
              }),
            ),
        },
      });
    }

    const myRank =
      rankings.find(
        (candidate) =>
          candidate.userId ===
          userId,
      ) ?? null;

    const canManage =
      await this.canManageSeason(
        userId,
        season,
      );

    return {
      success: true,
      data: {
        season: {
          id: season.id,
          name: season.name,
          startAt:
            season.startAt,
          endAt:
            season.endAt,
          minMatches:
            season.minMatches,
          rankingSize:
            season.rankingSize,
          soloOnly:
            season.soloOnly,
          status:
            season.status,
          league:
            season.league,
          tournaments:
            season.tournaments.map(
              (entry) =>
                entry.tournament,
            ),
          winner:
            season.winner,
          winnerRating:
            season.winnerRating,
          risingStarWinner:
            season.risingStarWinner,
          startedAt:
            season.startedAt,
          lockedAt:
            season.lockedAt,
          canManage,
        },
        criteria: {
          matchPerformance: 30,
          attack: 20,
          defence: 15,
          goalDifference: 15,
          bigMatchesAndTitles: 15,
          consistency: 5,
          risingStar:
            'Player account joined within 90 days before the season start (or during the season), and the normal minimum-match rule is met.',
        },
        rankings,
        myRank,
        risingStarRankings:
          ranking
            .filter(
              (
                candidate,
              ) =>
                candidate.risingStarEligible,
            )
            .slice(
              0,
              Math.min(
                10,
                season.rankingSize,
              ),
            )
            .map(
              (
                candidate,
                index,
              ) => ({
                ...candidate,
                rank:
                  index + 1,
              }),
            ),
      },
      error: null,
    };
  }

  async createBallonSeason(
    userId: string,
    dto: CreateBallonSeasonDto,
  ) {
    const startAt =
      new Date(
        dto.startAt,
      );

    const endAt =
      new Date(
        dto.endAt,
      );

    if (
      Number.isNaN(
        startAt.getTime(),
      ) ||
      Number.isNaN(
        endAt.getTime(),
      ) ||
      endAt <= startAt
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'INVALID_BALLON_PERIOD',
          message:
            'Ballon season end date must be after the start date.',
        },
      });
    }

    if (dto.leagueId) {
      await this.authorization.assertLeagueAdmin(
        userId,
        dto.leagueId,
      );
    } else if (
      !(
        await this.authorization.isSuperAdmin(
          userId,
        )
      )
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_GLOBAL_ADMIN_REQUIRED',
          message:
            'Only a Super Admin can create an all-league FC Arena Ballon season.',
        },
      });
    }

    const tournamentIds =
      dto.tournamentIds ??
      [];

    if (
      tournamentIds.length >
      0
    ) {
      const tournaments =
        await this.prisma.tournament.findMany({
          where: {
            id: {
              in: tournamentIds,
            },
          },
          select: {
            id: true,
            leagueId: true,
            mode: true,
          },
        });

      if (
        tournaments.length !==
        tournamentIds.length
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'BALLON_TOURNAMENT_NOT_FOUND',
            message:
              'One or more selected tournaments do not exist.',
          },
        });
      }

      if (
        dto.leagueId &&
        tournaments.some(
          (tournament) =>
            tournament.leagueId !==
            dto.leagueId,
        )
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'BALLON_TOURNAMENT_SCOPE_MISMATCH',
            message:
              'Selected tournaments must belong to the selected League.',
          },
        });
      }

      if (
        (dto.soloOnly ??
          true) &&
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
              'BALLON_SOLO_TOURNAMENT_REQUIRED',
            message:
              'Awards V1 Ballon seasons use SOLO tournaments for fair individual statistics.',
          },
        });
      }
    }

    const minMatches =
      dto.minMatches ??
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
          minMatches,
          rankingSize:
            dto.rankingSize ??
            20,
          soloOnly:
            dto.soloOnly ??
            true,
          leagueId:
            dto.leagueId ??
            null,
          createdByUserId:
            userId,
          tournaments:
            tournamentIds.length >
            0
              ? {
                  create:
                    tournamentIds.map(
                      (
                        tournamentId,
                      ) => ({
                        tournamentId,
                      }),
                    ),
                }
              : undefined,
        },
        include: {
          league: true,
          tournaments: {
            include: {
              tournament:
                true,
            },
          },
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

  async startBallonSeason(
    userId: string,
    seasonId: string,
  ) {
    const season =
      await this.requireManageableSeason(
        userId,
        seasonId,
      );

    if (
      season.status !==
      'DRAFT'
    ) {
      throw this.invalidBallonState(
        'Only a DRAFT Ballon season can be started.',
      );
    }

    const updated =
      await this.prisma.ballonSeason.update({
        where: {
          id: seasonId,
        },
        data: {
          status: 'LIVE',
          startedAt:
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

  async finalizeBallonSeason(
    userId: string,
    seasonId: string,
  ) {
    const season =
      await this.requireManageableSeason(
        userId,
        seasonId,
      );

    if (
      season.status !==
      'LIVE'
    ) {
      throw this.invalidBallonState(
        'Only a LIVE Ballon season can be finalized.',
      );
    }

    const fullSeason =
      await this.prisma.ballonSeason.findUnique({
        where: {
          id: seasonId,
        },
        include: {
          league: true,
          tournaments: {
            select: {
              tournamentId: true,
              tournament: true,
            },
          },
        },
      });

    if (!fullSeason) {
      throw this.ballonSeasonNotFound();
    }

    const ranking =
      await this.computeBallonRanking(
        fullSeason,
      );

    const winner =
      ranking[0];

    if (!winner) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_NO_ELIGIBLE_PLAYERS',
          message:
            'No player currently meets the minimum-match requirement for this Ballon season.',
        },
      });
    }

    const risingStar =
      ranking.find(
        (candidate) =>
          candidate.risingStarEligible,
      ) ??
      null;

    const now =
      new Date();

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const locked =
            await tx.ballonSeason.update({
              where: {
                id: seasonId,
              },
              data: {
                status:
                  'LOCKED',
                winnerUserId:
                  winner.userId,
                winnerRating:
                  winner.rating,
                risingStarWinnerUserId:
                  risingStar
                    ?.userId ??
                  null,
                lockedAt:
                  now,
              },
            });

          await tx.ballonRankingSnapshot.upsert({
            where: {
              seasonId_day: {
                seasonId,
                day:
                  this.utcDateOnly(
                    now,
                  ),
              },
            },
            create: {
              seasonId,
              day:
                this.utcDateOnly(
                  now,
                ),
              positions:
                ranking
                  .slice(
                    0,
                    season.rankingSize,
                  )
                  .map(
                    (
                      candidate,
                      index,
                    ) => ({
                      userId:
                        candidate.userId,
                      rank:
                        index + 1,
                      rating:
                        candidate.rating,
                    }),
                  ),
            },
            update: {
              capturedAt:
                now,
              positions:
                ranking
                  .slice(
                    0,
                    season.rankingSize,
                  )
                  .map(
                    (
                      candidate,
                      index,
                    ) => ({
                      userId:
                        candidate.userId,
                      rank:
                        index + 1,
                      rating:
                        candidate.rating,
                    }),
                  ),
            },
          });

          await tx.notification.upsert({
            where: {
              dedupeKey:
                `ballon:${seasonId}:winner:${winner.userId}`,
            },
            create: {
              userId:
                winner.userId,
              type:
                'ACHIEVEMENT_RECEIVED',
              title:
                'FC Arena Ballon Winner',
              message:
                `You won ${season.name} with a ${winner.rating} rating.`,
              href:
                '/awards',
              entityType:
                'BALLON_SEASON',
              entityId:
                seasonId,
              dedupeKey:
                `ballon:${seasonId}:winner:${winner.userId}`,
              eventAt:
                now,
            },
            update: {
              title:
                'FC Arena Ballon Winner',
              message:
                `You won ${season.name} with a ${winner.rating} rating.`,
              eventAt:
                now,
            },
          });

          if (
            risingStar &&
            risingStar.userId !==
              winner.userId
          ) {
            await tx.notification.upsert({
              where: {
                dedupeKey:
                  `ballon:${seasonId}:rising-star:${risingStar.userId}`,
              },
              create: {
                userId:
                  risingStar.userId,
                type:
                  'ACHIEVEMENT_RECEIVED',
                title:
                  'FC Arena Rising Star',
                message:
                  `You won the Rising Star honour for ${season.name}.`,
                href:
                  '/awards',
                entityType:
                  'BALLON_SEASON',
                entityId:
                  seasonId,
                dedupeKey:
                  `ballon:${seasonId}:rising-star:${risingStar.userId}`,
                eventAt:
                  now,
              },
              update: {
                title:
                  'FC Arena Rising Star',
                message:
                  `You won the Rising Star honour for ${season.name}.`,
                eventAt:
                  now,
              },
            });
          }

          return locked;
        },
        {
          isolationLevel:
            'Serializable',
        },
      );

    return {
      success: true,
      data: {
        season:
          updated,
        winner,
        risingStar,
      },
      error: null,
    };
  }

  async archiveBallonSeason(
    userId: string,
    seasonId: string,
  ) {
    const season =
      await this.requireManageableSeason(
        userId,
        seasonId,
      );

    if (
      season.status !==
      'LOCKED'
    ) {
      throw this.invalidBallonState(
        'Only a LOCKED Ballon season can be archived.',
      );
    }

    const updated =
      await this.prisma.ballonSeason.update({
        where: {
          id: seasonId,
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

  private async aggregateTournament(
    tournamentId: string,
    competitionFormat:
      string,
    legType: string,
  ) {
    const matches =
      await this.prisma.match.findMany({
        where: {
          tournamentId,
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
                          fullName:
                            true,
                          createdAt:
                            true,
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
                          fullName:
                            true,
                          createdAt:
                            true,
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
        orderBy: {
          updatedAt:
            'asc',
        },
      });

    const canonical =
      this.canonicalMatches(
        matches,
        competitionFormat,
        legType,
      );

    return this.aggregateMatches(
      canonical,
    );
  }

  private async computeBallonRanking(
    season: any,
  ): Promise<
    RankedCandidate[]
  > {
    const selectedTournamentIds =
      (
        season.tournaments ??
        []
      ).map(
        (
          entry: any,
        ) =>
          entry.tournamentId,
      );

    const matches =
      await this.prisma.match.findMany({
        where: {
          confirmedResultSubmissionId: {
            not: null,
          },
          tournament: {
            ...(season.soloOnly
              ? {
                  mode:
                    'SOLO',
                }
              : {}),
            ...(season.leagueId
              ? {
                  leagueId:
                    season.leagueId,
                }
              : {}),
            ...(selectedTournamentIds.length >
            0
              ? {
                  id: {
                    in:
                      selectedTournamentIds,
                  },
                }
              : {}),
          },
          confirmedResult: {
            is: {
              status:
                'CONFIRMED',
              reviewedAt: {
                gte:
                  season.startAt,
                lte:
                  season.endAt,
              },
            },
          },
        },
        include: {
          tournament: {
            select: {
              id: true,
              competitionFormat:
                true,
              legType: true,
            },
          },
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
                          fullName:
                            true,
                          createdAt:
                            true,
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
                          fullName:
                            true,
                          createdAt:
                            true,
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
        orderBy: {
          updatedAt:
            'asc',
        },
      });

    const byTournament =
      new Map<
        string,
        any[]
      >();

    for (
      const match
      of matches
    ) {
      const values =
        byTournament.get(
          match.tournament.id,
        ) ??
        [];

      values.push(
        match,
      );

      byTournament.set(
        match.tournament.id,
        values,
      );
    }

    const canonical:
      any[] =
      [];

    for (
      const group
      of byTournament.values()
    ) {
      if (
        group.length ===
        0
      ) {
        continue;
      }

      canonical.push(
        ...this.canonicalMatches(
          group,
          group[0]
            .tournament
            .competitionFormat,
          group[0]
            .tournament
            .legType,
        ),
      );
    }

    canonical.sort(
      (a, b) =>
        this.resultTime(a) -
        this.resultTime(b),
    );

    const aggregates =
      this.aggregateMatches(
        canonical,
      );

    const tournamentWhere =
      {
        ...(season.leagueId
          ? {
              leagueId:
                season.leagueId,
            }
          : {}),
        ...(season.soloOnly
          ? {
              mode:
                'SOLO' as const,
            }
          : {}),
        ...(selectedTournamentIds.length >
        0
          ? {
              id: {
                in:
                  selectedTournamentIds,
              },
            }
          : {}),
      };

    const honours =
      await this.prisma.achievement.findMany({
        where: {
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
              season.endAt,
          },
          tournament:
            tournamentWhere,
        },
        select: {
          userId: true,
          type: true,
        },
      });

    for (
      const honour
      of honours
    ) {
      const aggregate =
        aggregates.get(
          honour.userId,
        );

      if (!aggregate) {
        continue;
      }

      aggregate.bigMatchRaw +=
        honour.type ===
        'TOURNAMENT_CHAMPION'
          ? 3
          : 1;
    }

    const eligible =
      [...aggregates.values()].filter(
        (candidate) =>
          candidate.matches >=
          season.minMatches,
      );

    const risingStarThreshold =
      new Date(
        season.startAt,
      );

    risingStarThreshold.setUTCDate(
      risingStarThreshold.getUTCDate() -
        90,
    );

    return scoreAwardCandidates(
      eligible,
    )
      .map(
        (
          candidate,
        ) => ({
          ...candidate,
          goalDifference:
            candidate.goalsFor -
            candidate.goalsAgainst,
          eligible:
            true,
          risingStarEligible:
            candidate.joinedAt >=
            risingStarThreshold,
        }),
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.rating -
            a.rating ||
          b.wins -
            a.wins ||
          b.goalDifference -
            a.goalDifference ||
          b.goalsFor -
            a.goalsFor ||
          a.displayName.localeCompare(
            b.displayName,
          ),
      );
  }

  private canonicalMatches(
    matches: any[],
    competitionFormat:
      string,
    legType: string,
  ) {
    return deduplicateFixtureRecords(
      matches.map(
        (
          match,
        ) => ({
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
      ),
      competitionFormat,
      legType,
    )
      .filter(
        isCanonicalCompletedFixture,
      )
      .map(
        (
          fixture: any,
        ) =>
          fixture.sourceMatch,
      );
  }

  private aggregateMatches(
    matches: any[],
  ) {
    const aggregates =
      new Map<
        string,
        Aggregate
      >();

    const ensure = (
      member: any,
    ) => {
      const user =
        member.user;

      let aggregate =
        aggregates.get(
          user.id,
        );

      if (!aggregate) {
        aggregate = {
          userId:
            user.id,
          displayName:
            user.player
              ?.identity
              ?.inGameName ??
            user.fullName,
          fullName:
            user.fullName,
          playerCode:
            user.player
              ?.playerCode ??
            null,
          profileImageUrl:
            user.player
              ?.profileImageUrl ??
            null,
          joinedAt:
            user.createdAt,
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          cleanSheets: 0,
          goalDifference: 0,
          currentWinningStreak:
            0,
          maxWinningStreak:
            0,
          bigMatchRaw: 0,
        };

        aggregates.set(
          user.id,
          aggregate,
        );
      }

      return aggregate;
    };

    for (
      const match
      of matches
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

      if (
        !result ||
        homeMembers.length ===
          0 ||
        awayMembers.length ===
          0
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

      const bigMatchWeight =
        this.bigMatchWeight(
          match.fixture
            .roundName,
        );

      for (
        const member
        of homeMembers
      ) {
        const aggregate =
          ensure(
            member,
          );

        this.applyResult(
          aggregate,
          result.homeScore,
          result.awayScore,
          homeWon,
          draw,
        );

        if (homeWon) {
          aggregate.bigMatchRaw +=
            bigMatchWeight;
        }
      }

      for (
        const member
        of awayMembers
      ) {
        const aggregate =
          ensure(
            member,
          );

        this.applyResult(
          aggregate,
          result.awayScore,
          result.homeScore,
          awayWon,
          draw,
        );

        if (awayWon) {
          aggregate.bigMatchRaw +=
            bigMatchWeight;
        }
      }
    }

    return aggregates;
  }

  private applyResult(
    aggregate: Aggregate,
    goalsFor: number,
    goalsAgainst: number,
    won: boolean,
    draw: boolean,
  ) {
    aggregate.matches +=
      1;
    aggregate.goalsFor +=
      goalsFor;
    aggregate.goalsAgainst +=
      goalsAgainst;
    aggregate.goalDifference =
      aggregate.goalsFor -
      aggregate.goalsAgainst;

    if (
      goalsAgainst ===
      0
    ) {
      aggregate.cleanSheets +=
        1;
    }

    if (won) {
      aggregate.wins +=
        1;
      aggregate.currentWinningStreak +=
        1;
      aggregate.maxWinningStreak =
        Math.max(
          aggregate.maxWinningStreak,
          aggregate.currentWinningStreak,
        );
      return;
    }

    aggregate.currentWinningStreak =
      0;

    if (draw) {
      aggregate.draws +=
        1;
    } else {
      aggregate.losses +=
        1;
    }
  }

  private bigMatchWeight(
    roundName:
      string | null |
      undefined,
  ) {
    const round =
      (
        roundName ??
        ''
      ).toUpperCase();

    if (
      round.includes(
        'FINAL',
      ) &&
      !round.includes(
        'SEMI',
      ) &&
      !round.includes(
        'QUARTER',
      )
    ) {
      return 2;
    }

    if (
      round.includes(
        'SEMI',
      ) ||
      round ===
        'SF'
    ) {
      return 1;
    }

    if (
      round.includes(
        'QUARTER',
      ) ||
      round ===
        'QF'
    ) {
      return 0.5;
    }

    return 0;
  }

  private resultTime(
    match: any,
  ) {
    const value =
      match.confirmedResult
        ?.reviewedAt ??
      match.confirmedResult
        ?.updatedAt ??
      match.updatedAt;

    return new Date(
      value,
    ).getTime();
  }

  private defaultMinimumMatches(
    startAt: Date,
    endAt: Date,
  ) {
    const days =
      Math.ceil(
        (
          endAt.getTime() -
          startAt.getTime()
        ) /
          86_400_000,
      );

    if (days <= 35) {
      return 6;
    }

    if (days <= 70) {
      return 10;
    }

    return 15;
  }

  private utcDateOnly(
    value: Date,
  ) {
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
      ),
    );
  }

  private async assertLeagueMemberOrAdmin(
    userId: string,
    leagueId: string,
  ) {
    if (
      await this.authorization.isLeagueAdmin(
        userId,
        leagueId,
      )
    ) {
      return;
    }

    const membership =
      await this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
        select: {
          id: true,
        },
      });

    if (!membership) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_MEMBERSHIP_REQUIRED',
          message:
            'You must be a member of this League.',
        },
      });
    }
  }

  private async canManageSeason(
    userId: string,
    season: {
      leagueId:
        string | null;
      createdByUserId?:
        string;
    },
  ) {
    if (
      await this.authorization.isSuperAdmin(
        userId,
      )
    ) {
      return true;
    }

    if (
      season.createdByUserId ===
      userId
    ) {
      return true;
    }

    return season.leagueId
      ? this.authorization.isLeagueAdmin(
          userId,
          season.leagueId,
        )
      : false;
  }

  private async requireManageableSeason(
    userId: string,
    seasonId: string,
  ) {
    const season =
      await this.prisma.ballonSeason.findUnique({
        where: {
          id: seasonId,
        },
      });

    if (!season) {
      throw this.ballonSeasonNotFound();
    }

    if (
      !(
        await this.canManageSeason(
          userId,
          season,
        )
      )
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'BALLON_ADMIN_REQUIRED',
          message:
            'Ballon season management requires the creator, League Admin or Super Admin.',
        },
      });
    }

    return season;
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

  private ballonSeasonNotFound() {
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

  private invalidBallonState(
    message: string,
  ) {
    return new ConflictException({
      success: false,
      data: null,
      error: {
        code:
          'INVALID_BALLON_SEASON_STATE',
        message,
      },
    });
  }
}
