import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import { assertRoundRobinComplete } from './completion-integrity.js';
import {
  deduplicateFixtureRecords,
  isCanonicalCompletedFixture,
} from '../tournaments/fixture-deduplication.js';
import {
  countMissingRequiredFixtureResults,
} from './competition-completion.js';
import {
  calculatePerformanceRatings,
  tiedGoldenBootWinners,
  tiedGoldenGloveWinners,
  type AwardMetricRow,
} from './award-scoring.js';

@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async completeTournament(
    adminUserId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.authorization.assertCanManageTournament(adminUserId, tournamentId);

    if (
      tournament.status ===
      'CANCELLED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_CANCELLED',

          message:
            'A cancelled Tournament cannot be completed.',
        },
      });
    }

    if (
      tournament.status ===
      'COMPLETED'
    ) {
      return this.getTournamentAchievements(
        adminUserId,
        tournamentId,
      );
    }

    const matches =
      await this.prisma.match.findMany({
        where: {
          tournamentId,
        },

        select: {
          id: true,
          status: true,
          confirmedResultSubmissionId:
            true,
        },
      });

    if (
      matches.length === 0
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'NO_TOURNAMENT_MATCHES',

          message:
            'Tournament has no Matches to complete.',
        },
      });
    }

    const unfinished =
      matches.filter(
        (match) =>
          match.status !==
            'COMPLETED' &&
          match.status !==
            'CANCELLED',
      );

    if (
      unfinished.length > 0
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_MATCHES_INCOMPLETE',

          message:
            `${unfinished.length} Tournament Match(es) are not completed or cancelled.`,
        },
      });
    }

    const missingRequiredResults =
      countMissingRequiredFixtureResults(
        matches,
        tournament.competitionFormat,
        tournament.legType,
      );

    if (
      missingRequiredResults >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'DOUBLE_LEG_RESULTS_INCOMPLETE',

          message:
            `Double Leg tournaments require a confirmed score for every fixture. ${missingRequiredResults} match(es) are still missing a confirmed result.`,
        },
      });
    }


    const verifiedCount =
      matches.filter(
        (match) =>
          Boolean(
            match.confirmedResultSubmissionId,
          ),
      ).length;

    if (
      verifiedCount === 0
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'NO_VERIFIED_RESULTS',

          message:
            'Tournament cannot complete without confirmed results.',
        },
      });
    }

    await this.prisma.$transactionWithRetry(
      async (tx) => {
        const currentTournament =
          await tx.tournament.findUnique({
            where: {
              id: tournamentId,
            },
          });

        if (!currentTournament) {
          throw this.tournamentNotFound();
        }

        if (
          currentTournament.status ===
          'COMPLETED'
        ) {
          return;
        }
        if (currentTournament.status === 'CANCELLED') {
          throw new ConflictException({ success: false, data: null, error: {
            code: 'TOURNAMENT_CANCELLED', message: 'A cancelled Tournament cannot be completed.',
          } });
        }

        const currentMatches = await tx.match.findMany({
          where: { tournamentId }, include: { confirmedResult: true },
        });
        if (currentMatches.some((match) => match.status !== 'CANCELLED' &&
          (match.status !== 'COMPLETED' || !match.confirmedResult || match.confirmedResult.status !== 'CONFIRMED'))) {
          throw new ConflictException({ success: false, data: null, error: {
            code: 'TOURNAMENT_MATCHES_INCOMPLETE', message: 'Every played match must have a confirmed result.',
          } });
        }

        const registrations =
          await tx.tournamentRegistration.findMany({
            where: {
              tournamentId,
              status: 'APPROVED',
            },

            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,

                      player: {
                        select: {
                          playerCode: true,

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
          });

        if (
          registrations.length <
          2
        ) {
          throw new ConflictException({
            success: false,
            data: null,
            error: {
              code:
                'NOT_ENOUGH_PARTICIPANTS',

              message:
                'At least two approved participants are required.',
            },
          });
        }

        const groupCount =
          await tx.tournamentGroup.count({
            where: {
              tournamentId,
            },
          });

        const playoffFixtureCount =
          await tx.fixture.count({
            where: {
              tournamentId,

              groupId: null,
            },
          });

        if (
          groupCount > 0 &&
          playoffFixtureCount === 0
        ) {
          throw new ConflictException({
            success: false,
            data: null,

            error: {
              code:
                'PLAYOFF_STAGE_REQUIRED',

              message:
                'Generate and complete the knockout stage before completing this grouped Tournament.',
            },
          });
        }

        const hasGroupPlayoffs =
          groupCount > 0 &&
          playoffFixtureCount > 0;

        const completionFixtures = await tx.fixture.findMany({
          where: { tournamentId }, include: { match: { include: { confirmedResult: true } } },
        });
        assertRoundRobinComplete(currentTournament, registrations, completionFixtures);

        const placement =
          hasGroupPlayoffs ||
          currentTournament.format ===
            'KNOCKOUT'
            ? await this.getKnockoutPlacement(
                tx,
                tournamentId,
              )
            : await this.getRoundRobinPlacement(
                tx,
                tournamentId,
              );

        for (
          const registration
          of registrations
        ) {
          for (
            const member
            of registration.members
          ) {
            await this.award(
              tx,
              member.user.id,
              tournamentId,
              'TOURNAMENT_PARTICIPATION',
              'ðŸŽ– Tournament Participation',
              `Participated in ${currentTournament.name}.`,
              {
                tournament:
                  currentTournament.name,
                registrationId:
                  registration.id,
              },
            );
          }
        }

        if (
          placement.champion
        ) {
          for (
            const member
            of placement.champion
              .members
          ) {
            await this.award(
              tx,
              member.userId,
              tournamentId,
              'TOURNAMENT_CHAMPION',
              `ðŸ† ${currentTournament.name} Champion`,
              `Champion of ${currentTournament.name}.`,
              {
                registrationId:
                  placement.champion.id,
              },
            );
          }
        }

        if (
          placement.runnerUp
        ) {
          for (
            const member
            of placement.runnerUp
              .members
          ) {
            await this.award(
              tx,
              member.userId,
              tournamentId,
              'TOURNAMENT_RUNNER_UP',
              `ðŸ¥ˆ ${currentTournament.name} Runner-Up`,
              `Runner-up in ${currentTournament.name}.`,
              {
                registrationId:
                  placement.runnerUp.id,
              },
            );
          }
        }

        const statistics =
          await tx.playerTournamentStatistic.findMany({
            where: {
              tournamentId,

              matches: {
                gt: 0,
              },
            },

            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,

                  player: {
                    select: {
                      playerCode: true,

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
          });

        if (
          statistics.length > 0 &&
          currentTournament.mode ===
            'SOLO'
        ) {
          const awardMetrics =
            await this.buildTournamentAwardMetrics(
              tx,
              tournamentId,
              statistics,
              placement,
            );

          const rated =
            calculatePerformanceRatings(
              awardMetrics,
            );

          const best =
            rated[0];

          if (best) {
            await this.award(
              tx,
              best.userId,
              tournamentId,
              'BEST_PLAYER',
              '⭐ Player of the Tournament',
              `Player of the Tournament in ${currentTournament.name} with a ${best.rating.toFixed(1)} FC Arena rating.`,
              {
                rating:
                  best.rating,
                matches:
                  best.matches,
                wins:
                  best.wins,
                draws:
                  best.draws,
                losses:
                  best.losses,
                goalsFor:
                  best.goalsFor,
                goalsAgainst:
                  best.goalsAgainst,
                cleanSheets:
                  best.cleanSheets,
                goalDifference:
                  best.goalDifference,
                ratingBreakdown:
                  JSON.stringify(
                    best.ratingBreakdown,
                  ),
              },
            );
          }

          const goldenBootPlayers =
            tiedGoldenBootWinners(
              awardMetrics,
            );

          for (
            const player
            of goldenBootPlayers
          ) {
            const goalsPerMatch =
              player.matches > 0
                ? player.goalsFor /
                  player.matches
                : 0;

            await this.award(
              tx,
              player.userId,
              tournamentId,
              'GOLDEN_BOOT',
              '⚽ Golden Boot',
              `Top scorer in ${currentTournament.name} with ${player.goalsFor} verified goals.`,
              {
                goals:
                  player.goalsFor,
                matches:
                  player.matches,
                goalsPerMatch:
                  Number(
                    goalsPerMatch.toFixed(
                      2,
                    ),
                  ),
                goalDifference:
                  player.goalDifference,
                wins:
                  player.wins,
              },
            );
          }

          const goldenGlovePlayers =
            tiedGoldenGloveWinners(
              awardMetrics,
            );

          for (
            const player
            of goldenGlovePlayers
          ) {
            const cleanSheetRate =
              player.matches > 0
                ? (
                    player.cleanSheets /
                    player.matches
                  ) *
                  100
                : 0;

            const goalsAgainstPerMatch =
              player.matches > 0
                ? player.goalsAgainst /
                  player.matches
                : 0;

            await this.award(
              tx,
              player.userId,
              tournamentId,
              'GOLDEN_GLOVE',
              '🧤 Golden Glove',
              `Best defensive record in ${currentTournament.name} with ${player.cleanSheets} clean sheet(s).`,
              {
                cleanSheets:
                  player.cleanSheets,
                cleanSheetRate:
                  Number(
                    cleanSheetRate.toFixed(
                      1,
                    ),
                  ),
                goalsAgainst:
                  player.goalsAgainst,
                goalsAgainstPerMatch:
                  Number(
                    goalsAgainstPerMatch.toFixed(
                      2,
                    ),
                  ),
                matches:
                  player.matches,
              },
            );
          }
        }

        const streaks =
          await this.calculateWinningStreaks(
            tx,
            tournamentId,
          );

        for (
          const [
            userId,
            streak,
          ] of streaks.entries()
        ) {
          if (
            streak < 3
          ) {
            continue;
          }

          await this.award(
            tx,
            userId,
            tournamentId,
            'WINNING_STREAK',
            'ðŸ”¥ Winning Streak',
            `Recorded a ${streak}-match winning streak in ${currentTournament.name}.`,
            {
              winningStreak:
                streak,
            },
          );
        }

        const completedAt =
          new Date();

        const summarySnapshot =
          await this.buildTournamentSummarySnapshot(
            tx,
            tournamentId,
            currentTournament,
            placement,
            completedAt,
          );

        await tx.tournamentSummary.upsert({
          where: {
            tournamentId,
          },
          create: {
            tournamentId,
            snapshot:
              summarySnapshot,
            publishedByUserId:
              adminUserId,
            publishedAt:
              completedAt,
          },
          update: {
            snapshot:
              summarySnapshot,
            publishedByUserId:
              adminUserId,
            publishedAt:
              completedAt,
          },
        });

        await tx.tournament.update({
          where: {
            id: tournamentId,
          },

          data: {
            status:
              'COMPLETED',

            completedAt,
          },
        });
      },
      {
        isolationLevel:
          'Serializable',
      },
    );

    return this.getTournamentAchievements(
      adminUserId,
      tournamentId,
    );
  }

  async getTournamentAwardRaces(
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
          name: true,
          code: true,
          mode: true,
          format: true,
          status: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMember(
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
          tournament,
          available: false,
          reason:
            'Individual Golden Boot, Golden Glove and Player of the Tournament races require SOLO statistics in V1. Team-level scores are never attributed to every member.',
          goldenBoot: [],
          goldenGlove: [],
          playerOfTournament:
            [],
        },

        error: null,
      };
    }

    const statistics =
      await this.prisma.playerTournamentStatistic.findMany({
        where: {
          tournamentId,

          matches: {
            gt: 0,
          },
        },

        include: {
          user: {
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

    const metrics =
      await this.buildTournamentAwardMetrics(
        this.prisma,
        tournamentId,
        statistics,
      );

    const statisticByUser =
      new Map(
        statistics.map(
          (statistic) => [
            statistic.userId,
            statistic,
          ],
        ),
      );

    const decorate = (
      row: AwardMetricRow,
      position: number,
      rating?: number,
      ratingBreakdown?: unknown,
    ) => {
      const statistic =
        statisticByUser.get(
          row.userId,
        );

      const matches =
        Math.max(
          0,
          row.matches,
        );

      return {
        position,
        userId:
          row.userId,
        fullName:
          statistic?.user
            .fullName ??
          'Player',
        inGameName:
          statistic?.user
            .player
            ?.identity
            ?.inGameName ??
          null,
        playerCode:
          statistic?.user
            .player
            ?.playerCode ??
          null,
        profileImageUrl:
          statistic?.user
            .player
            ?.profileImageUrl ??
          null,
        matches:
          row.matches,
        wins:
          row.wins,
        draws:
          row.draws,
        losses:
          row.losses,
        goals:
          row.goalsFor,
        goalsAgainst:
          row.goalsAgainst,
        goalDifference:
          row.goalDifference,
        goalsPerMatch:
          matches > 0
            ? Number(
                (
                  row.goalsFor /
                  matches
                ).toFixed(2),
              )
            : 0,
        cleanSheets:
          row.cleanSheets,
        cleanSheetRate:
          matches > 0
            ? Number(
                (
                  (
                    row.cleanSheets /
                    matches
                  ) *
                  100
                ).toFixed(1),
              )
            : 0,
        goalsAgainstPerMatch:
          matches > 0
            ? Number(
                (
                  row.goalsAgainst /
                  matches
                ).toFixed(2),
              )
            : 0,
        rating:
          rating ??
          null,
        ratingBreakdown:
          ratingBreakdown ??
          null,
      };
    };

    const goldenBoot =
      [...metrics]
        .sort(
          (
            first,
            second,
          ) => {
            const firstGpm =
              first.matches > 0
                ? first.goalsFor /
                  first.matches
                : 0;

            const secondGpm =
              second.matches > 0
                ? second.goalsFor /
                  second.matches
                : 0;

            return (
              second.goalsFor -
                first.goalsFor ||
              secondGpm -
                firstGpm ||
              second.goalDifference -
                first.goalDifference ||
              second.wins -
                first.wins ||
              first.userId.localeCompare(
                second.userId,
              )
            );
          },
        )
        .slice(0, 20)
        .map(
          (row, index) =>
            decorate(
              row,
              index + 1,
            ),
        );

    const goldenGlove =
      [...metrics]
        .filter(
          (row) =>
            row.matches > 0,
        )
        .sort(
          (
            first,
            second,
          ) => {
            const firstRate =
              first.cleanSheets /
              first.matches;

            const secondRate =
              second.cleanSheets /
              second.matches;

            const firstGa =
              first.goalsAgainst /
              first.matches;

            const secondGa =
              second.goalsAgainst /
              second.matches;

            return (
              second.cleanSheets -
                first.cleanSheets ||
              secondRate -
                firstRate ||
              firstGa -
                secondGa ||
              second.matches -
                first.matches ||
              first.goalsAgainst -
                second.goalsAgainst ||
              first.userId.localeCompare(
                second.userId,
              )
            );
          },
        )
        .slice(0, 20)
        .map(
          (row, index) =>
            decorate(
              row,
              index + 1,
            ),
        );

    const playerOfTournament =
      calculatePerformanceRatings(
        metrics,
      )
        .slice(0, 20)
        .map(
          (row, index) =>
            decorate(
              row,
              index + 1,
              row.rating,
              row.ratingBreakdown,
            ),
        );

    return {
      success: true,

      data: {
        tournament,
        available: true,
        reason: null,
        goldenBoot,
        goldenGlove,
        playerOfTournament,
      },

      error: null,
    };
  }

  async getTournamentAchievements(
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
          code: true,
          leagueId: true,
          mode: true,
          format: true,
          status: true,
          completedAt: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

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

    const achievements =
      await this.prisma.achievement.findMany({
        where: {
          tournamentId,
        },

        include: {
          user: {
            select: {
              id: true,
              fullName: true,

              player: {
                select: {
                  playerCode: true,

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

        orderBy: [
          {
            awardedAt:
              'asc',
          },
          {
            type:
              'asc',
          },
        ],
      });

    return {
      success: true,

      data: {
        tournament,

        isLeagueAdmin:
          Boolean(admin),

        achievements,
      },

      error: null,
    };
  }

  async getTournamentSummary(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
        include: {
          summary:
            true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

    if (
      tournament.status !==
      'COMPLETED'
    ) {
      return {
        success: true,
        data: {
          available:
            false,
          tournament: {
            id:
              tournament.id,
            name:
              tournament.name,
            code:
              tournament.code,
            status:
              tournament.status,
            logoUrl:
              tournament.logoUrl,
          },
          summary:
            null,
          publishedAt:
            null,
          legacyDerived:
            false,
        },
        error: null,
      };
    }

    if (
      tournament.summary
    ) {
      return {
        success: true,
        data: {
          available:
            true,
          tournament: {
            id:
              tournament.id,
            name:
              tournament.name,
            code:
              tournament.code,
            status:
              tournament.status,
            logoUrl:
              tournament.logoUrl,
          },
          summary:
            tournament.summary
              .snapshot,
          publishedAt:
            tournament.summary
              .publishedAt,
          legacyDerived:
            false,
        },
        error: null,
      };
    }

    const groupCount =
      await this.prisma.tournamentGroup.count({
        where: {
          tournamentId,
        },
      });

    const playoffFixtureCount =
      await this.prisma.fixture.count({
        where: {
          tournamentId,
          groupId:
            null,
        },
      });

    const placement =
      (
        groupCount >
          0 &&
        playoffFixtureCount >
          0
      ) ||
      tournament.format ===
        'KNOCKOUT'
        ? await this.getKnockoutPlacement(
            this.prisma,
            tournamentId,
          )
        : await this.getRoundRobinPlacement(
            this.prisma,
            tournamentId,
          );

    const snapshot =
      await this.buildTournamentSummarySnapshot(
        this.prisma,
        tournamentId,
        tournament,
        placement,
        tournament.completedAt,
      );

    return {
      success: true,
      data: {
        available:
          true,
        tournament: {
          id:
            tournament.id,
          name:
            tournament.name,
          code:
            tournament.code,
          status:
            tournament.status,
          logoUrl:
            tournament.logoUrl,
        },
        summary:
          snapshot,
        publishedAt:
          tournament.completedAt,
        legacyDerived:
          true,
      },
      error: null,
    };
  }

  async getTournamentSummaryHistory(
    userId: string,
  ) {
    const tournaments =
      await this.prisma.tournament.findMany({
        where: {
          status:
            'COMPLETED',
          league: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
        include: {
          league: {
            select: {
              id: true,
              name: true,
            },
          },
          summary:
            true,
        },
        orderBy: [
          {
            completedAt:
              'desc',
          },
          {
            updatedAt:
              'desc',
          },
        ],
        take: 50,
      });

    return {
      success: true,
      data: {
        summaries:
          tournaments.map(
            (
              tournament,
            ) => ({
              tournament: {
                id:
                  tournament.id,
                name:
                  tournament.name,
                code:
                  tournament.code,
                logoUrl:
                  tournament.logoUrl,
                mode:
                  tournament.mode,
                competitionFormat:
                  tournament.competitionFormat,
                completedAt:
                  tournament.completedAt,
                league:
                  tournament.league,
              },
              summary:
                tournament.summary
                  ?.snapshot ??
                null,
              publishedAt:
                tournament.summary
                  ?.publishedAt ??
                tournament.completedAt,
              legacyDerived:
                !tournament.summary,
            }),
          ),
      },
      error: null,
    };
  }

  async getMyAchievements(
    userId: string,
  ) {
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
          awardedAt:
            'desc',
        },
      });

    return {
      success: true,

      data: {
        achievements,
      },

      error: null,
    };
  }

  private async getRoundRobinPlacement(
    tx: any,
    tournamentId: string,
  ) {
    const standings =
      await tx.tournamentStanding.findMany({
        where: {
          tournamentId,
        },

        orderBy: [
          {
            points:
              'desc',
          },
          {
            goalDifference:
              'desc',
          },
          {
            goalsFor:
              'desc',
          },
          {
            wins:
              'desc',
          },
        ],

        include: {
          registration: {
            include: {
              members: true,
            },
          },
        },
      });

    if (
      standings.length <
      2
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'STANDINGS_INCOMPLETE',

          message:
            'Tournament standings are not sufficient to determine Champion and Runner-Up.',
        },
      });
    }

    return {
      champion:
        standings[0]
          .registration,

      runnerUp:
        standings[1]
          .registration,

      thirdPlace:
        standings[2]
          ? [
              standings[2]
                .registration,
            ]
          : [],
    };
  }

  private async getKnockoutPlacement(
    tx: any,
    tournamentId: string,
  ) {
    const fixtures =
      await tx.fixture.findMany({
        where: {
          tournamentId,

          groupId: null,
        },

        orderBy: [
          {
            roundNumber:
              'desc',
          },
          {
            bracketPosition:
              'asc',
          },
        ],

        include: {
          homeRegistration: {
            include: {
              members: true,
            },
          },

          awayRegistration: {
            include: {
              members: true,
            },
          },

          match: {
            include: {
              confirmedResult:
                true,
            },
          },
        },
      });

    const isPlacementFinalName = (
      value: string,
    ) => {
      const normalized =
        value.toLowerCase();

      return (
        normalized.includes(
          'third',
        ) ||
        normalized.includes(
          '3rd',
        ) ||
        normalized.includes(
          'bronze',
        )
      );
    };

    const finalFixture =
      fixtures.find(
        (fixture: any) =>
          fixture.roundName
            ?.toLowerCase()
            .includes(
              'final',
            ) &&
          !isPlacementFinalName(
            fixture.roundName ??
              '',
          ) &&
          fixture.nextFixtureId ===
            null &&
          isCanonicalCompletedFixture(
            fixture,
          ) &&
          fixture.homeRegistration &&
          fixture.awayRegistration,
      ) ??
      fixtures.find(
        (fixture: any) =>
          fixture.roundNumber ===
            fixtures[0]
              ?.roundNumber &&
          fixture.nextFixtureId ===
            null &&
          !isPlacementFinalName(
            fixture.roundName ??
              '',
          ) &&
          isCanonicalCompletedFixture(
            fixture,
          ) &&
          fixture.homeRegistration &&
          fixture.awayRegistration,
      );

    if (
      !finalFixture ||
      !finalFixture.match
        ?.confirmedResult ||
      !finalFixture
        .homeRegistration ||
      !finalFixture
        .awayRegistration
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'FINAL_RESULT_REQUIRED',

          message:
            'A confirmed Knockout Final result is required before completing the Tournament.',
        },
      });
    }

    const result =
      finalFixture.match
        .confirmedResult;

    if (
      result.homeScore ===
      result.awayScore
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'FINAL_WINNER_REQUIRED',

          message:
            'Knockout Final cannot end in a draw.',
        },
      });
    }

    const champion =
      result.homeScore >
      result.awayScore
        ? finalFixture
            .homeRegistration
        : finalFixture
            .awayRegistration;

    const runnerUp =
      result.homeScore >
      result.awayScore
        ? finalFixture
            .awayRegistration
        : finalFixture
            .homeRegistration;

    const resolveFixtureWinnerLoser = (
      fixture: any,
    ) => {
      const fixtureResult =
        fixture.match
          ?.confirmedResult;

      if (
        !fixtureResult ||
        !fixture.homeRegistration ||
        !fixture.awayRegistration ||
        fixtureResult.homeScore ===
          fixtureResult.awayScore
      ) {
        return null;
      }

      return fixtureResult.homeScore >
        fixtureResult.awayScore
        ? {
            winner:
              fixture.homeRegistration,
            loser:
              fixture.awayRegistration,
          }
        : {
            winner:
              fixture.awayRegistration,
            loser:
              fixture.homeRegistration,
          };
    };

    const explicitThirdPlace =
      fixtures.find(
        (fixture: any) =>
          fixture.id !==
            finalFixture.id &&
          isPlacementFinalName(
            fixture.roundName ??
              '',
          ) &&
          isCanonicalCompletedFixture(
            fixture,
          ),
      );

    const explicitThirdOutcome =
      explicitThirdPlace
        ? resolveFixtureWinnerLoser(
            explicitThirdPlace,
          )
        : null;

    const semifinalLosers =
      explicitThirdOutcome
        ? []
        : fixtures
            .filter(
              (fixture: any) =>
                fixture.nextFixtureId ===
                  finalFixture.id &&
                isCanonicalCompletedFixture(
                  fixture,
                ),
            )
            .map(
              resolveFixtureWinnerLoser,
            )
            .filter(
              (
                outcome: any,
              ) =>
                Boolean(
                  outcome?.loser,
                ),
            )
            .map(
              (
                outcome: any,
              ) =>
                outcome.loser,
            );

    return {
      champion,
      runnerUp,
      thirdPlace:
        explicitThirdOutcome
          ? [
              explicitThirdOutcome.winner,
            ]
          : semifinalLosers.slice(
              0,
              2,
            ),
    };
  }

  private async buildTournamentSummarySnapshot(
    tx: any,
    tournamentId: string,
    tournament: any,
    placement: {
      champion?: any | null;
      runnerUp?: any | null;
      thirdPlace?: any[];
    },
    completedAt:
      Date | string | null,
  ) {
    const registrations =
      await tx.tournamentRegistration.findMany({
        where: {
          tournamentId,
          status:
            'APPROVED',
        },
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
      });

    const registrationById =
      new Map(
        registrations.map(
          (
            registration: any,
          ) => [
            registration.id,
            registration,
          ],
        ),
      );

    const entrySnapshot = (
      registration:
        any | null | undefined,
    ) => {
      if (!registration) {
        return null;
      }

      const full =
        registrationById.get(
          registration.id,
        ) ??
        registration;

      const firstMember =
        full.members?.[0]
          ?.user;

      return {
        registrationId:
          full.id,
        name:
          full.entryName ||
          firstMember?.player
            ?.identity
            ?.inGameName ||
          firstMember?.fullName ||
          'Tournament Entry',
        logoUrl:
          full.entryLogoUrl ??
          null,
        members:
          (
            full.members ??
            []
          ).map(
            (
              member: any,
            ) => ({
              userId:
                member.userId ??
                member.user?.id,
              name:
                member.user?.player
                  ?.identity
                  ?.inGameName ||
                member.user
                  ?.fullName ||
                'Player',
              playerCode:
                member.user?.player
                  ?.playerCode ??
                null,
              profileImageUrl:
                member.user?.player
                  ?.profileImageUrl ??
                null,
            }),
          ),
      };
    };

    const achievements =
      await tx.achievement.findMany({
        where: {
          tournamentId,
          type: {
            in: [
              'GOLDEN_BOOT',
              'GOLDEN_GLOVE',
              'BEST_PLAYER',
            ],
          },
        },
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
        orderBy: {
          awardedAt:
            'asc',
        },
      });

    const awardWinners = (
      type: string,
    ) =>
      achievements
        .filter(
          (
            achievement: any,
          ) =>
            achievement.type ===
            type,
        )
        .map(
          (
            achievement: any,
          ) => ({
            userId:
              achievement.user.id,
            name:
              achievement.user.player
                ?.identity
                ?.inGameName ||
              achievement.user
                .fullName,
            playerCode:
              achievement.user.player
                ?.playerCode ??
              null,
            profileImageUrl:
              achievement.user.player
                ?.profileImageUrl ??
              null,
            description:
              achievement.description ??
              null,
            metadata:
              achievement.metadata ??
              null,
          }),
        );

    const standings =
      await tx.tournamentStanding.findMany({
        where: {
          tournamentId,
        },
        include: {
          registration:
            true,
        },
        orderBy: [
          {
            points:
              'desc',
          },
          {
            goalDifference:
              'desc',
          },
          {
            goalsFor:
              'desc',
          },
        ],
      });

    const completedMatches =
      await tx.match.findMany({
        where: {
          tournamentId,
          status:
            'COMPLETED',
          confirmedResultSubmissionId: {
            not: null,
          },
        },
        include: {
          confirmedResult:
            true,
          fixture: {
            select: {
              id: true,
              roundName:
                true,
              homeRegistrationId:
                true,
              awayRegistrationId:
                true,
            },
          },
        },
      });

    let totalGoals = 0;
    let biggestWin:
      any | null = null;

    for (
      const match
      of completedMatches
    ) {
      const result =
        match.confirmedResult;

      if (!result) {
        continue;
      }

      totalGoals +=
        result.homeScore +
        result.awayScore;

      const margin =
        Math.abs(
          result.homeScore -
            result.awayScore,
        );

      if (
        !biggestWin ||
        margin >
          biggestWin.margin
      ) {
        const home =
          registrationById.get(
            match.fixture
              .homeRegistrationId,
          );
        const away =
          registrationById.get(
            match.fixture
              .awayRegistrationId,
          );

        biggestWin = {
          margin,
          roundName:
            match.fixture
              .roundName,
          home:
            entrySnapshot(
              home,
            ),
          away:
            entrySnapshot(
              away,
            ),
          homeScore:
            result.homeScore,
          awayScore:
            result.awayScore,
        };
      }
    }

    const scoringLeader =
      [
        ...standings,
      ].sort(
        (
          first: any,
          second: any,
        ) =>
          second.goalsFor -
            first.goalsFor ||
          second.points -
            first.points,
      )[0] ??
      null;

    const defenceLeader =
      [
        ...standings,
      ]
        .filter(
          (
            row: any,
          ) =>
            row.played >
            0,
        )
        .sort(
          (
            first: any,
            second: any,
          ) =>
            first.goalsAgainst -
              second.goalsAgainst ||
            second.points -
              first.points,
        )[0] ??
      null;

    return {
      version: 1,
      tournament: {
        id:
          tournament.id,
        name:
          tournament.name,
        code:
          tournament.code,
        mode:
          tournament.mode,
        format:
          tournament.format,
        competitionFormat:
          tournament.competitionFormat,
        logoUrl:
          tournament.logoUrl ??
          null,
        completedAt:
          completedAt
            ? new Date(
                completedAt,
              ).toISOString()
            : null,
      },
      placements: {
        champion:
          entrySnapshot(
            placement.champion,
          ),
        runnerUp:
          entrySnapshot(
            placement.runnerUp,
          ),
        thirdPlace:
          (
            placement.thirdPlace ??
            []
          )
            .map(
              entrySnapshot,
            )
            .filter(
              Boolean,
            ),
      },
      awards: {
        goldenBoot:
          awardWinners(
            'GOLDEN_BOOT',
          ),
        goldenGlove:
          awardWinners(
            'GOLDEN_GLOVE',
          ),
        playerOfTournament:
          awardWinners(
            'BEST_PLAYER',
          ),
      },
      stats: {
        entries:
          registrations.length,
        completedMatches:
          completedMatches.length,
        totalGoals,
        averageGoalsPerMatch:
          completedMatches.length >
          0
            ? Number(
                (
                  totalGoals /
                  completedMatches.length
                ).toFixed(2),
              )
            : 0,
        highestScoringTeam:
          scoringLeader
            ? {
                entry:
                  entrySnapshot(
                    scoringLeader
                      .registration,
                  ),
                goals:
                  scoringLeader
                    .goalsFor,
              }
            : null,
        bestDefence:
          defenceLeader
            ? {
                entry:
                  entrySnapshot(
                    defenceLeader
                      .registration,
                  ),
                goalsAgainst:
                  defenceLeader
                    .goalsAgainst,
              }
            : null,
        biggestWin,
      },
    };
  }

  private async buildTournamentAwardMetrics(
    tx: any,
    tournamentId: string,
    statistics: any[],
    placement?: {
      champion?: {
        members: {
          userId: string;
        }[];
      } | null;

      runnerUp?: {
        members: {
          userId: string;
        }[];
      } | null;
    },
  ): Promise<AwardMetricRow[]> {
    const tournament =
      await tx.tournament.findUnique({
        where: {
          id: tournamentId,
        },

        select: {
          competitionFormat:
            true,
          legType:
            true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    const matches =
      await tx.match.findMany({
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
                  members: true,
                },
              },

              awayRegistration: {
                include: {
                  members: true,
                },
              },
            },
          },
        },
      });

    const canonicalMatches =
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
      )
        .map(
          (fixture: any) =>
            fixture.sourceMatch,
        )
        .sort(
          (
            first: any,
            second: any,
          ) =>
            first.fixture
              .sequence -
            second.fixture
              .sequence,
        );

    const metrics =
      new Map<
        string,
        AwardMetricRow
      >(
        statistics.map(
          (statistic) => [
            statistic.userId,
            {
              userId:
                statistic.userId,
              matches:
                statistic.matches,
              wins:
                statistic.wins,
              draws:
                statistic.draws,
              losses:
                statistic.losses,
              goalsFor:
                statistic.goalsFor,
              goalsAgainst:
                statistic.goalsAgainst,
              goalDifference:
                statistic.goalDifference,
              cleanSheets: 0,
              bigMatchPoints: 0,
              longestWinStreak: 0,
            },
          ],
        ),
      );

    const currentStreak =
      new Map<string, number>();

    const applySide = (
      userIds: string[],
      won: boolean,
      cleanSheet: boolean,
      roundName: string,
    ) => {
      const normalizedRound =
        roundName.toLowerCase();

      const knockoutWinBonus =
        !won
          ? 0
          : normalizedRound.includes(
                'quarter',
              ) ||
              normalizedRound ===
                'qf'
            ? 0.5
            : normalizedRound.includes(
                  'semi',
                ) ||
                normalizedRound ===
                  'sf'
              ? 1
              : normalizedRound.includes(
                    'final',
                  )
                ? 2
                : 0;

      for (
        const userId
        of userIds
      ) {
        const metric =
          metrics.get(
            userId,
          );

        if (!metric) {
          continue;
        }

        if (cleanSheet) {
          metric.cleanSheets +=
            1;
        }

        metric.bigMatchPoints +=
          knockoutWinBonus;

        const streak =
          won
            ? (
                currentStreak.get(
                  userId,
                ) ?? 0
              ) + 1
            : 0;

        currentStreak.set(
          userId,
          streak,
        );

        metric.longestWinStreak =
          Math.max(
            metric.longestWinStreak,
            streak,
          );
      }
    };

    for (
      const match
      of canonicalMatches
    ) {
      const result =
        match.confirmedResult;

      const home =
        match.fixture
          .homeRegistration;

      const away =
        match.fixture
          .awayRegistration;

      if (
        !result ||
        !home ||
        !away
      ) {
        continue;
      }

      applySide(
        home.members.map(
          (member: any) =>
            member.userId,
        ),
        result.homeScore >
          result.awayScore,
        result.awayScore ===
          0,
        match.fixture
          .roundName ??
          '',
      );

      applySide(
        away.members.map(
          (member: any) =>
            member.userId,
        ),
        result.awayScore >
          result.homeScore,
        result.homeScore ===
          0,
        match.fixture
          .roundName ??
          '',
      );
    }

    for (
      const member
      of placement?.champion
        ?.members ??
      []
    ) {
      const metric =
        metrics.get(
          member.userId,
        );

      if (metric) {
        metric.bigMatchPoints +=
          3;
      }
    }

    for (
      const member
      of placement?.runnerUp
        ?.members ??
      []
    ) {
      const metric =
        metrics.get(
          member.userId,
        );

      if (metric) {
        metric.bigMatchPoints +=
          1;
      }
    }

    return [
      ...metrics.values(),
    ];
  }

  private async calculateWinningStreaks(
    tx: any,
    tournamentId: string,
  ) {
    const matches =
      await tx.match.findMany({
        where: {
          tournamentId,

          confirmedResultSubmissionId: {
            not: null,
          },
        },

        orderBy: {
          updatedAt:
            'asc',
        },

        include: {
          confirmedResult:
            true,

          fixture: {
            include: {
              homeRegistration: {
                include: {
                  members: true,
                },
              },

              awayRegistration: {
                include: {
                  members: true,
                },
              },
            },
          },
        },
      });

    const current =
      new Map<string, number>();

    const maximum =
      new Map<string, number>();

    const applyOutcome = (
      userId: string,
      won: boolean,
    ) => {
      const next =
        won
          ? (current.get(
              userId,
            ) ?? 0) + 1
          : 0;

      current.set(
        userId,
        next,
      );

      maximum.set(
        userId,
        Math.max(
          maximum.get(
            userId,
          ) ?? 0,
          next,
        ),
      );
    };

    for (
      const match
      of matches
    ) {
      const result =
        match.confirmedResult;

      const home =
        match.fixture
          .homeRegistration;

      const away =
        match.fixture
          .awayRegistration;

      if (
        !result ||
        !home ||
        !away
      ) {
        continue;
      }

      const homeWon =
        result.homeScore >
        result.awayScore;

      const awayWon =
        result.awayScore >
        result.homeScore;

      for (
        const member
        of home.members
      ) {
        applyOutcome(
          member.userId,
          homeWon,
        );
      }

      for (
        const member
        of away.members
      ) {
        applyOutcome(
          member.userId,
          awayWon,
        );
      }
    }

    return maximum;
  }

  private async award(
    tx: any,
    userId: string,
    tournamentId: string,
    type:
      | 'TOURNAMENT_CHAMPION'
      | 'TOURNAMENT_RUNNER_UP'
      | 'GOLDEN_BOOT'
      | 'GOLDEN_GLOVE'
      | 'BEST_PLAYER'
      | 'WINNING_STREAK'
      | 'TOURNAMENT_PARTICIPATION',
    title: string,
    description: string,
    metadata: Record<
      string,
      string | number
    >,
  ) {
    await tx.achievement.upsert({
      where: {
        userId_tournamentId_type: {
          userId,
          tournamentId,
          type,
        },
      },

      create: {
        userId,
        tournamentId,
        type,
        title,
        description,
        metadata,
      },

      update: {
        title,
        description,
        metadata,
      },
    });
  }

  private async assertLeagueMember(
    userId: string,
    leagueId: string,
  ) {
    const membership =
      await this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
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