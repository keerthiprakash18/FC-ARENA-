import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

interface PlayerRankingRow {
  userId: string;
  fullName: string;
  playerCode: string | null;
  inGameName: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
  performancePoints: number;
  form: string;
}

@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getTournamentRankings(
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

    const statistics =
      await this.prisma.playerTournamentStatistic.findMany({
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
      });

    const playerRows:
      PlayerRankingRow[] =
      statistics.map(
        (statistic) =>
          this.mapPlayer(
            statistic,
          ),
      );

    const bestPlayers =
      [...playerRows]
        .sort(
          (a, b) =>
            b.performancePoints -
              a.performancePoints ||
            b.winRate -
              a.winRate ||
            b.goalDifference -
              a.goalDifference ||
            b.goalsFor -
              a.goalsFor ||
            a.fullName.localeCompare(
              b.fullName,
            ),
        )
        .slice(0, 20);

    const mostWins =
      [...playerRows]
        .sort(
          (a, b) =>
            b.wins -
              a.wins ||
            b.winRate -
              a.winRate ||
            b.goalDifference -
              a.goalDifference ||
            a.fullName.localeCompare(
              b.fullName,
            ),
        )
        .slice(0, 20);

    const highestWinRate =
      playerRows
        .filter(
          (row) =>
            row.matches > 0,
        )
        .sort(
          (a, b) =>
            b.winRate -
              a.winRate ||
            b.matches -
              a.matches ||
            b.wins -
              a.wins ||
            a.fullName.localeCompare(
              b.fullName,
            ),
        )
        .slice(0, 20);

    const bestGoalDifference =
      [...playerRows]
        .sort(
          (a, b) =>
            b.goalDifference -
              a.goalDifference ||
            b.goalsFor -
              a.goalsFor ||
            b.wins -
              a.wins ||
            a.fullName.localeCompare(
              b.fullName,
            ),
        )
        .slice(0, 20);

    const topGoals =
      tournament.mode ===
      'SOLO'
        ? {
            available: true,

            reason: null,

            entries:
              [...playerRows]
                .sort(
                  (a, b) =>
                    b.goalsFor -
                      a.goalsFor ||
                    b.wins -
                      a.wins ||
                    a.fullName.localeCompare(
                      b.fullName,
                    ),
                )
                .slice(0, 20),
          }
        : {
            available: false,

            reason:
              'Individual scorers are not available from team-level match scores. Match-event goal data is required.',

            entries:
              [] as PlayerRankingRow[],
          };

    const standings =
      await this.prisma.tournamentStanding.findMany({
        where: {
          tournamentId,
        },

        include: {
          registration: {
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
          },
        },

        orderBy: [
          {
            points: 'desc',
          },
          {
            goalDifference:
              'desc',
          },
          {
            goalsFor: 'desc',
          },
          {
            wins: 'desc',
          },
        ],
      });

    const bestTeams =
      tournament.mode ===
      'TEAM'
        ? {
            available: true,

            reason: null,

            entries:
              standings
                .map(
                  (
                    standing,
                    index,
                  ) => ({
                    position:
                      index + 1,

                    registrationId:
                      standing.registrationId,

                    entryName:
                      standing.registration
                        .entryName ??
                      standing.registration
                        .members
                        .map(
                          (member) =>
                            member.user
                              .player
                              ?.identity
                              ?.inGameName ??
                            member.user
                              .fullName,
                        )
                        .join(' + '),

                    played:
                      standing.played,

                    wins:
                      standing.wins,

                    draws:
                      standing.draws,

                    losses:
                      standing.losses,

                    goalsFor:
                      standing.goalsFor,

                    goalsAgainst:
                      standing.goalsAgainst,

                    goalDifference:
                      standing.goalDifference,

                    points:
                      standing.points,

                    form:
                      standing.form,
                  }),
                )
                .slice(0, 20),
          }
        : {
            available: false,

            reason:
              'Best Teams is available for TEAM tournaments.',

            entries: [],
          };

    const myBestPlayerPosition =
      bestPlayers.findIndex(
        (row) =>
          row.userId ===
          userId,
      );

    return {
      success: true,

      data: {
        tournament,

        myPosition:
          myBestPlayerPosition >=
          0
            ? myBestPlayerPosition +
              1
            : null,

        categories: {
          bestPlayers:
            this.withPositions(
              bestPlayers,
            ),

          mostWins:
            this.withPositions(
              mostWins,
            ),

          highestWinRate:
            this.withPositions(
              highestWinRate,
            ),

          bestGoalDifference:
            this.withPositions(
              bestGoalDifference,
            ),

          topGoals: {
            ...topGoals,

            entries:
              this.withPositions(
                topGoals.entries,
              ),
          },

          topAssists: {
            available: false,

            reason:
              'Assists are not captured by the current verified result data. Match Events must be implemented before an assists leaderboard is valid.',

            entries: [],
          },

          bestTeams,
        },
      },

      error: null,
    };
  }

  async getLeagueRankings(
    userId: string,
    leagueId: string,
    mode?: string,
  ) {
    await this.assertLeagueMember(
      userId,
      leagueId,
    );

    const allowedModes =
      new Set([
        'SOLO',
        'DUO',
        'TEAM',
      ]);

    const competitionMode =
      mode &&
      allowedModes.has(
        mode.toUpperCase(),
      )
        ? mode.toUpperCase()
        : null;

    const statistics =
      await this.prisma.playerTournamentStatistic.findMany({
        where: {
          tournament: {
            leagueId,

            ...(competitionMode
              ? {
                  mode:
                    competitionMode as
                      | 'SOLO'
                      | 'DUO'
                      | 'TEAM',
                }
              : {}),
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

    const aggregate =
      new Map<
        string,
        PlayerRankingRow
      >();

    for (
      const statistic
      of statistics
    ) {
      const mapped =
        this.mapPlayer(
          statistic,
        );

      const existing =
        aggregate.get(
          mapped.userId,
        );

      if (!existing) {
        aggregate.set(
          mapped.userId,
          {
            ...mapped,
          },
        );

        continue;
      }

      existing.matches +=
        mapped.matches;

      existing.wins +=
        mapped.wins;

      existing.draws +=
        mapped.draws;

      existing.losses +=
        mapped.losses;

      existing.goalsFor +=
        mapped.goalsFor;

      existing.goalsAgainst +=
        mapped.goalsAgainst;

      existing.goalDifference =
        existing.goalsFor -
        existing.goalsAgainst;

      existing.performancePoints =
        existing.wins * 3 +
        existing.draws;

      existing.winRate =
        existing.matches > 0
          ? Number(
              (
                (existing.wins /
                  existing.matches) *
                100
              ).toFixed(1),
            )
          : 0;
    }

    const rows =
      [...aggregate.values()];

    rows.sort(
      (a, b) =>
        b.performancePoints -
          a.performancePoints ||
        b.winRate -
          a.winRate ||
        b.goalDifference -
          a.goalDifference ||
        b.goalsFor -
          a.goalsFor ||
        a.fullName.localeCompare(
          b.fullName,
        ),
    );

    return {
      success: true,

      data: {
        leagueId,

        filter: {
          mode:
            competitionMode,
        },

        rankings:
          this.withPositions(
            rows.slice(
              0,
              100,
            ),
          ),
      },

      error: null,
    };
  }

  private mapPlayer(
    statistic: any,
  ): PlayerRankingRow {
    const matches =
      statistic.matches;

    const wins =
      statistic.wins;

    return {
      userId:
        statistic.user.id,

      fullName:
        statistic.user
          .fullName,

      playerCode:
        statistic.user.player
          ?.playerCode ??
        null,

      inGameName:
        statistic.user.player
          ?.identity
          ?.inGameName ??
        null,

      matches,

      wins,

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

      winRate:
        matches > 0
          ? Number(
              (
                (wins /
                  matches) *
                100
              ).toFixed(1),
            )
          : 0,

      performancePoints:
        statistic.wins * 3 +
        statistic.draws,

      form:
        statistic.form,
    };
  }

  private withPositions<
    T extends object,
  >(rows: T[]) {
    return rows.map(
      (row, index) => ({
        position:
          index + 1,

        ...row,
      }),
    );
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