import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
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

    await this.assertLeagueAdmin(
      adminUserId,
      tournament.leagueId,
    );

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

    await this.prisma.$transaction(
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

        const placement =
          currentTournament.format ===
          'ROUND_ROBIN'
            ? await this.getRoundRobinPlacement(
                tx,
                tournamentId,
              )
            : await this.getKnockoutPlacement(
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
              '🎖 Tournament Participation',
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
              `🏆 ${currentTournament.name} Champion`,
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
              `🥈 ${currentTournament.name} Runner-Up`,
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
          statistics.length > 0
        ) {
          const ranked =
            [...statistics].sort(
              (a, b) => {
                const aPoints =
                  a.wins * 3 +
                  a.draws;

                const bPoints =
                  b.wins * 3 +
                  b.draws;

                const aRate =
                  a.matches > 0
                    ? a.wins /
                      a.matches
                    : 0;

                const bRate =
                  b.matches > 0
                    ? b.wins /
                      b.matches
                    : 0;

                return (
                  bPoints -
                    aPoints ||
                  bRate -
                    aRate ||
                  b.goalDifference -
                    a.goalDifference ||
                  b.goalsFor -
                    a.goalsFor ||
                  a.user.fullName.localeCompare(
                    b.user.fullName,
                  )
                );
              },
            );

          const best =
            ranked[0];

          await this.award(
            tx,
            best.userId,
            tournamentId,
            'BEST_PLAYER',
            '⭐ Best Player',
            `Best Player of ${currentTournament.name}.`,
            {
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
              goalDifference:
                best.goalDifference,
            },
          );

          if (
            currentTournament.mode ===
            'SOLO'
          ) {
            const topGoals =
              Math.max(
                ...statistics.map(
                  (stat) =>
                    stat.goalsFor,
                ),
              );

            if (
              topGoals > 0
            ) {
              const goldenBootPlayers =
                statistics.filter(
                  (stat) =>
                    stat.goalsFor ===
                    topGoals,
                );

              for (
                const player
                of goldenBootPlayers
              ) {
                await this.award(
                  tx,
                  player.userId,
                  tournamentId,
                  'GOLDEN_BOOT',
                  '⚽ Golden Boot',
                  `Top scorer in ${currentTournament.name} with ${topGoals} goals.`,
                  {
                    goals:
                      topGoals,
                  },
                );
              }
            }
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
            '🔥 Winning Streak',
            `Recorded a ${streak}-match winning streak in ${currentTournament.name}.`,
            {
              winningStreak:
                streak,
            },
          );
        }

        await tx.tournament.update({
          where: {
            id: tournamentId,
          },

          data: {
            status:
              'COMPLETED',

            completedAt:
              new Date(),
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

    const finalFixture =
      fixtures.find(
        (fixture: any) =>
          fixture.match
            ?.confirmedResult &&
          fixture
            .homeRegistration &&
          fixture
            .awayRegistration,
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

    if (
      result.homeScore >
      result.awayScore
    ) {
      return {
        champion:
          finalFixture
            .homeRegistration,

        runnerUp:
          finalFixture
            .awayRegistration,
      };
    }

    return {
      champion:
        finalFixture
          .awayRegistration,

      runnerUp:
        finalFixture
          .homeRegistration,
    };
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