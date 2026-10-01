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
import type {
  CreateLeagueWarDto,
  LeagueWarWalkoverDto,
  SetLeagueWarReadyDto,
  SetLeagueWarRosterDto,
  UpdateLeagueWarResultDto,
} from './dto/league-war.dto.js';

type WarCore = {
  id?: string;
  homeLeagueId: string;
  awayLeagueId: string;
  legType?: string;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
};

export interface SideScore {
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

type AccessState = {
  canView: boolean;
  isSuperAdmin: boolean;
  adminLeagueIds: string[];
};

@Injectable()
export class LeagueWarsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async getWars(
    userId: string,
  ): Promise<any> {
    await this.expireInvites();

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
      throw this.permissionRequired();
    }

    const memberships =
      user.role ===
      'SUPER_ADMIN'
        ? []
        : await this.prisma.leagueMember.findMany({
            where: {
              userId,
            },
            select: {
              leagueId: true,
            },
          });

    const leagueIds =
      memberships.map(
        (
          item,
        ) =>
          item.leagueId,
      );

    const wars =
      await this.prisma.leagueWar.findMany({
        where:
          user.role ===
          'SUPER_ADMIN'
            ? undefined
            : {
                OR: [
                  {
                    homeLeagueId: {
                      in:
                        leagueIds,
                    },
                  },
                  {
                    awayLeagueId: {
                      in:
                        leagueIds,
                    },
                  },
                ],
              },
        include: {
          homeLeague: {
            select: {
              id: true,
              name: true,
              code: true,
              logoUrl: true,
            },
          },
          awayLeague: {
            select: {
              id: true,
              name: true,
              code: true,
              logoUrl: true,
            },
          },
          winnerLeague: {
            select: {
              id: true,
              name: true,
            },
          },
          participants: {
            select: {
              leagueId: true,
            },
          },
          matches: {
            select: {
              leg: true,
              status: true,
              homeScore: true,
              awayScore: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 150,
      });

    return {
      success: true,
      data: {
        wars:
          wars.map(
            (
              war,
            ) => ({
              id: war.id,
              name: war.name,
              status: war.status,
              playerCount:
                war.playerCount,
              legType:
                war.legType,
              pairingMode:
                war.pairingMode,
              winPoints:
                war.winPoints,
              drawPoints:
                war.drawPoints,
              lossPoints:
                war.lossPoints,
              challengeExpiresAt:
                war.challengeExpiresAt,
              scheduledStartAt:
                war.scheduledStartAt,
              deadlineAt:
                war.deadlineAt,
              homeReadyAt:
                war.homeReadyAt,
              awayReadyAt:
                war.awayReadyAt,
              createdAt:
                war.createdAt,
              startedAt:
                war.startedAt,
              completedAt:
                war.completedAt,
              homeLeague:
                war.homeLeague,
              awayLeague:
                war.awayLeague,
              winnerLeague:
                war.winnerLeague,
              roster: {
                home:
                  war.participants.filter(
                    (
                      row,
                    ) =>
                      row.leagueId ===
                      war.homeLeagueId,
                  ).length,
                away:
                  war.participants.filter(
                    (
                      row,
                    ) =>
                      row.leagueId ===
                      war.awayLeagueId,
                  ).length,
              },
              summary:
                this.summary(
                  war,
                  war.matches,
                ),
            }),
          ),
      },
      error: null,
    };
  }

  async getRankings(): Promise<any> {
    const wars =
      await this.prisma.leagueWar.findMany({
        where: {
          status:
            'COMPLETED',
        },
        include: {
          homeLeague: {
            select: {
              id: true,
              name: true,
              code: true,
              logoUrl: true,
            },
          },
          awayLeague: {
            select: {
              id: true,
              name: true,
              code: true,
              logoUrl: true,
            },
          },
          matches: {
            where: {
              status:
                'COMPLETED',
            },
            include: {
              homePlayer: {
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
              awayPlayer: {
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
        orderBy: {
          completedAt:
            'desc',
        },
        take: 500,
      });

    const leagues =
      new Map<
        string,
        {
          league: {
            id: string;
            name: string;
            code: string;
            logoUrl:
              string | null;
          };
          played: number;
          wins: number;
          draws: number;
          losses: number;
          ratingPoints: number;
          battlePointsFor: number;
          battlePointsAgainst: number;
          battlePointDifference: number;
        }
      >();

    const playerRows =
      new Map<
        string,
        {
          userId: string;
          fullName: string;
          inGameName:
            string | null;
          playerCode:
            string | null;
          matches: number;
          wins: number;
          draws: number;
          losses: number;
          goalsFor: number;
          goalsAgainst: number;
          goalDifference: number;
        }
      >();

    const ensureLeague =
      (
        league:
          {
            id: string;
            name: string;
            code: string;
            logoUrl:
              string | null;
          },
      ) => {
        let row =
          leagues.get(
            league.id,
          );

        if (!row) {
          row = {
            league,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            ratingPoints: 0,
            battlePointsFor: 0,
            battlePointsAgainst: 0,
            battlePointDifference: 0,
          };

          leagues.set(
            league.id,
            row,
          );
        }

        return row;
      };

    const addPlayer =
      (
        player:
          any,
        scored:
          number,
        conceded:
          number,
      ) => {
        let row =
          playerRows.get(
            player.id,
          );

        if (!row) {
          row = {
            userId:
              player.id,
            fullName:
              player.fullName,
            inGameName:
              player.player
                ?.identity
                ?.inGameName ??
              null,
            playerCode:
              player.player
                ?.playerCode ??
              null,
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
          };

          playerRows.set(
            player.id,
            row,
          );
        }

        row.matches +=
          1;
        row.goalsFor +=
          scored;
        row.goalsAgainst +=
          conceded;
        row.goalDifference =
          row.goalsFor -
          row.goalsAgainst;

        if (
          scored >
          conceded
        ) {
          row.wins +=
            1;
        } else if (
          scored <
          conceded
        ) {
          row.losses +=
            1;
        } else {
          row.draws +=
            1;
        }
      };

    for (
      const war
      of wars
    ) {
      const summary =
        this.summary(
          war,
          war.matches,
        );

      const home =
        ensureLeague(
          war.homeLeague,
        );
      const away =
        ensureLeague(
          war.awayLeague,
        );

      home.played +=
        1;
      away.played +=
        1;

      home.battlePointsFor +=
        summary.home.points;
      home.battlePointsAgainst +=
        summary.away.points;
      away.battlePointsFor +=
        summary.away.points;
      away.battlePointsAgainst +=
        summary.home.points;

      if (
        war.winnerLeagueId ===
        war.homeLeagueId
      ) {
        home.wins +=
          1;
        away.losses +=
          1;
        home.ratingPoints +=
          3;
      } else if (
        war.winnerLeagueId ===
        war.awayLeagueId
      ) {
        away.wins +=
          1;
        home.losses +=
          1;
        away.ratingPoints +=
          3;
      } else {
        home.draws +=
          1;
        away.draws +=
          1;
        home.ratingPoints +=
          1;
        away.ratingPoints +=
          1;
      }

      home.battlePointDifference =
        home.battlePointsFor -
        home.battlePointsAgainst;
      away.battlePointDifference =
        away.battlePointsFor -
        away.battlePointsAgainst;

      for (
        const match
        of war.matches
      ) {
        if (
          match.homeScore ===
            null ||
          match.awayScore ===
            null
        ) {
          continue;
        }

        addPlayer(
          match.homePlayer,
          match.homeScore,
          match.awayScore,
        );
        addPlayer(
          match.awayPlayer,
          match.awayScore,
          match.homeScore,
        );
      }
    }

    const leagueRankings =
      Array.from(
        leagues.values(),
      )
        .sort(
          (
            first,
            second,
          ) =>
            second.ratingPoints -
              first.ratingPoints ||
            second.wins -
              first.wins ||
            second.battlePointDifference -
              first.battlePointDifference ||
            second.battlePointsFor -
              first.battlePointsFor ||
            first.league.name.localeCompare(
              second.league.name,
            ),
        )
        .map(
          (
            row,
            index,
          ) => ({
            position:
              index +
              1,
            ...row,
            winRate:
              row.played >
              0
                ? Number(
                    (
                      (row.wins /
                        row.played) *
                      100
                    ).toFixed(
                      1,
                    ),
                  )
                : 0,
          }),
        );

    const playerRankings =
      Array.from(
        playerRows.values(),
      )
        .sort(
          (
            first,
            second,
          ) =>
            second.wins -
              first.wins ||
            second.goalDifference -
              first.goalDifference ||
            second.goalsFor -
              first.goalsFor ||
            first.losses -
              second.losses,
        )
        .slice(
          0,
          50,
        )
        .map(
          (
            row,
            index,
          ) => ({
            position:
              index +
              1,
            ...row,
            winRate:
              row.matches >
              0
                ? Number(
                    (
                      (row.wins /
                        row.matches) *
                      100
                    ).toFixed(
                      1,
                    ),
                  )
                : 0,
          }),
        );

    return {
      success: true,
      data: {
        leagueRankings,
        playerRankings,
      },
      error: null,
    };
  }

  async createWar(
    userId: string,
    dto:
      CreateLeagueWarDto,
  ): Promise<any> {
    await this.expireInvites();

    await this.assertLeagueAdmin(
      userId,
      dto.homeLeagueId,
    );

    const opponent =
      await this.prisma.league.findUnique({
        where: {
          code:
            dto.opponentLeagueCode
              .trim()
              .toUpperCase(),
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
      });

    if (!opponent) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_OPPONENT_NOT_FOUND',
          message:
            'Opponent League Code was not found.',
        },
      });
    }

    if (
      opponent.id ===
      dto.homeLeagueId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_SELF_CHALLENGE',
          message:
            'A League cannot challenge itself.',
        },
      });
    }

    const home =
      await this.prisma.league.findUnique({
        where: {
          id:
            dto.homeLeagueId,
        },
        select: {
          id: true,
          name: true,
        },
      });

    if (!home) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_NOT_FOUND',
          message:
            'Your League could not be found.',
        },
      });
    }

    await this.assertNoActiveWar(
      home.id,
      opponent.id,
    );

    const now =
      new Date();

    const expiry =
      new Date(
        now.getTime() +
          (dto.challengeExpiryHours ??
            48) *
            60 *
            60 *
            1000,
      );

    const scheduledStartAt =
      dto.scheduledStartAt
        ? new Date(
            dto.scheduledStartAt,
          )
        : null;

    const deadlineAt =
      dto.deadlineAt
        ? new Date(
            dto.deadlineAt,
          )
        : null;

    if (
      scheduledStartAt &&
      deadlineAt &&
      deadlineAt <=
        scheduledStartAt
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_INVALID_SCHEDULE',
          message:
            'War deadline must be after the scheduled start.',
        },
      });
    }

    const war =
      await this.prisma.leagueWar.create({
        data: {
          name:
            dto.name
              ?.trim() ||
            `${home.name} vs ${opponent.name}`,
          homeLeagueId:
            home.id,
          awayLeagueId:
            opponent.id,
          createdByUserId:
            userId,
          playerCount:
            dto.playerCount,
          legType:
            dto.legType,
          pairingMode:
            dto.pairingMode ??
            'SLOT',
          winPoints:
            dto.winPoints ??
            3,
          drawPoints:
            dto.drawPoints ??
            1,
          lossPoints:
            dto.lossPoints ??
            0,
          challengeExpiresAt:
            expiry,
          scheduledStartAt,
          deadlineAt,
          status:
            'INVITED',
        },
      });

    return {
      success: true,
      data: {
        message:
          'League War challenge created. Opponent admin must accept it.',
        war,
      },
      error: null,
    };
  }

  async getWar(
    userId: string,
    warId: string,
  ): Promise<any> {
    await this.expireInvites();

    const war =
      await this.requireWar(
        warId,
      );

    const access =
      await this.accessFor(
        userId,
        war,
      );

    if (
      !access.canView
    ) {
      throw this.permissionRequired();
    }

    const [
      participants,
      matches,
      rivalryWars,
    ] =
      await Promise.all([
        this.prisma.leagueWarParticipant.findMany({
          where: {
            warId,
          },
          orderBy: [
            {
              leagueId:
                'asc',
            },
            {
              slot:
                'asc',
            },
          ],
          include: {
            user: {
              select:
                this.playerSelect(),
            },
          },
        }),
        this.prisma.leagueWarMatch.findMany({
          where: {
            warId,
          },
          orderBy: {
            sequence:
              'asc',
          },
          include: {
            homePlayer: {
              select:
                this.playerSelect(),
            },
            awayPlayer: {
              select:
                this.playerSelect(),
            },
          },
        }),
        this.prisma.leagueWar.findMany({
          where: {
            id: {
              not:
                warId,
            },
            status:
              'COMPLETED',
            OR: [
              {
                homeLeagueId:
                  war.homeLeagueId,
                awayLeagueId:
                  war.awayLeagueId,
              },
              {
                homeLeagueId:
                  war.awayLeagueId,
                awayLeagueId:
                  war.homeLeagueId,
              },
            ],
          },
          include: {
            matches: {
              select: {
                leg: true,
                status: true,
                homeScore: true,
                awayScore: true,
              },
            },
          },
          orderBy: {
            completedAt:
              'desc',
          },
          take: 50,
        }),
      ]);

    const manageableIds =
      access.adminLeagueIds;

    const candidateRows =
      manageableIds.length >
      0
        ? await this.prisma.leagueMember.findMany({
            where: {
              leagueId: {
                in:
                  manageableIds,
              },
              user: {
                status:
                  'ACTIVE',
              },
            },
            orderBy: {
              joinedAt:
                'asc',
            },
            include: {
              user: {
                select:
                  this.playerSelect(),
              },
            },
          })
        : [];

    const serialize =
      (
        user:
          any,
      ) =>
        this.serializePlayer(
          user,
        );

    const summary =
      this.summary(
        war,
        matches,
      );

    const playerStats =
      this.playerStats(
        matches,
      );

    const mvp =
      playerStats[0] ??
      null;

    const rivalry =
      this.rivalrySummary(
        war,
        rivalryWars,
      );

    return {
      success: true,
      data: {
        war: {
          id: war.id,
          name: war.name,
          status: war.status,
          playerCount:
            war.playerCount,
          legType:
            war.legType,
          pairingMode:
            war.pairingMode,
          winPoints:
            war.winPoints,
          drawPoints:
            war.drawPoints,
          lossPoints:
            war.lossPoints,
          challengeExpiresAt:
            war.challengeExpiresAt,
          scheduledStartAt:
            war.scheduledStartAt,
          deadlineAt:
            war.deadlineAt,
          acceptedAt:
            war.acceptedAt,
          homeReadyAt:
            war.homeReadyAt,
          awayReadyAt:
            war.awayReadyAt,
          homeRosterLockedAt:
            war.homeRosterLockedAt,
          awayRosterLockedAt:
            war.awayRosterLockedAt,
          rejectedAt:
            war.rejectedAt,
          rejectionReason:
            war.rejectionReason,
          cancelledAt:
            war.cancelledAt,
          cancellationReason:
            war.cancellationReason,
          startedAt:
            war.startedAt,
          completedAt:
            war.completedAt,
          winnerLeagueId:
            war.winnerLeagueId,
          rematchOfWarId:
            war.rematchOfWarId,
          homeLeague:
            war.homeLeague,
          awayLeague:
            war.awayLeague,
          readiness: {
            home:
              Boolean(
                war.homeReadyAt,
              ),
            away:
              Boolean(
                war.awayReadyAt,
              ),
          },
          permissions: {
            canManageHome:
              access.adminLeagueIds.includes(
                war.homeLeagueId,
              ),
            canManageAway:
              access.adminLeagueIds.includes(
                war.awayLeagueId,
              ),
            canAccept:
              war.status ===
                'INVITED' &&
              access.adminLeagueIds.includes(
                war.awayLeagueId,
              ),
            canReject:
              war.status ===
                'INVITED' &&
              access.adminLeagueIds.includes(
                war.awayLeagueId,
              ),
            canCancel:
              [
                'INVITED',
                'ACCEPTED',
              ].includes(
                war.status,
              ) &&
              access.adminLeagueIds.includes(
                war.homeLeagueId,
              ),
            canStart:
              war.status ===
                'ACCEPTED' &&
              Boolean(
                war.homeReadyAt,
              ) &&
              Boolean(
                war.awayReadyAt,
              ) &&
              access.adminLeagueIds.length >
                0 &&
              (
                !war.scheduledStartAt ||
                new Date() >=
                  war.scheduledStartAt
              ),
            canUpdateResults:
              war.status ===
                'LIVE' &&
              access.adminLeagueIds.length >
                0,
            canComplete:
              war.status ===
                'LIVE' &&
              access.adminLeagueIds.length >
                0,
            canRematch:
              [
                'COMPLETED',
                'REJECTED',
                'CANCELLED',
                'EXPIRED',
              ].includes(
                war.status,
              ) &&
              access.adminLeagueIds.length >
                0,
          },
          roster: {
            home:
              participants
                .filter(
                  (
                    row,
                  ) =>
                    row.leagueId ===
                    war.homeLeagueId,
                )
                .map(
                  (
                    row,
                  ) => ({
                    id:
                      row.id,
                    slot:
                      row.slot,
                    leagueId:
                      row.leagueId,
                    user:
                      serialize(
                        row.user,
                      ),
                  }),
                ),
            away:
              participants
                .filter(
                  (
                    row,
                  ) =>
                    row.leagueId ===
                    war.awayLeagueId,
                )
                .map(
                  (
                    row,
                  ) => ({
                    id:
                      row.id,
                    slot:
                      row.slot,
                    leagueId:
                      row.leagueId,
                    user:
                      serialize(
                        row.user,
                      ),
                  }),
                ),
          },
          candidates: {
            home:
              access.adminLeagueIds.includes(
                war.homeLeagueId,
              )
                ? candidateRows
                    .filter(
                      (
                        row,
                      ) =>
                        row.leagueId ===
                        war.homeLeagueId,
                    )
                    .map(
                      (
                        row,
                      ) =>
                        serialize(
                          row.user,
                        ),
                    )
                : [],
            away:
              access.adminLeagueIds.includes(
                war.awayLeagueId,
              )
                ? candidateRows
                    .filter(
                      (
                        row,
                      ) =>
                        row.leagueId ===
                        war.awayLeagueId,
                    )
                    .map(
                      (
                        row,
                      ) =>
                        serialize(
                          row.user,
                        ),
                    )
                : [],
          },
          matches:
            matches.map(
              (
                match,
              ) => {
                const matchHomeLeagueId =
                  this.matchHomeLeagueId(
                    war,
                    match.leg,
                  );

                const matchAwayLeagueId =
                  matchHomeLeagueId ===
                  war.homeLeagueId
                    ? war.awayLeagueId
                    : war.homeLeagueId;

                const pending =
                  [
                    'PENDING_CONFIRMATION',
                    'WALKOVER_PENDING',
                  ].includes(
                    match.resultStatus,
                  );

                const canConfirm =
                  pending &&
                  (
                    access.isSuperAdmin ||
                    (
                      Boolean(
                        match.resultSubmittedByLeagueId,
                      ) &&
                      access.adminLeagueIds.some(
                        (
                          leagueId,
                        ) =>
                          leagueId !==
                          match.resultSubmittedByLeagueId,
                      )
                    )
                  );

                return {
                  id:
                    match.id,
                  sequence:
                    match.sequence,
                  leg:
                    match.leg,
                  status:
                    match.status,
                  resultStatus:
                    match.resultStatus,
                  homeScore:
                    match.homeScore,
                  awayScore:
                    match.awayScore,
                  proofUrl:
                    match.proofUrl,
                  disputeReason:
                    match.disputeReason,
                  walkoverLeagueId:
                    match.walkoverLeagueId,
                  resultSubmittedByLeagueId:
                    match.resultSubmittedByLeagueId,
                  submittedAt:
                    match.submittedAt,
                  confirmedAt:
                    match.confirmedAt,
                  disputedAt:
                    match.disputedAt,
                  completedAt:
                    match.completedAt,
                  homeLeagueId:
                    matchHomeLeagueId,
                  awayLeagueId:
                    matchAwayLeagueId,
                  homePlayer:
                    serialize(
                      match.homePlayer,
                    ),
                  awayPlayer:
                    serialize(
                      match.awayPlayer,
                    ),
                  permissions: {
                    canSubmit:
                      war.status ===
                        'LIVE' &&
                      access.adminLeagueIds.length >
                        0,
                    canConfirm,
                    canDispute:
                      canConfirm,
                  },
                };
              },
            ),
          summary,
          playerStats,
          mvp,
          rivalry,
        },
      },
      error: null,
    };
  }

  async acceptWar(
    userId: string,
    warId: string,
  ): Promise<any> {
    await this.expireInvites();

    const war =
      await this.requireWar(
        warId,
      );

    await this.assertLeagueAdmin(
      userId,
      war.awayLeagueId,
    );

    if (
      war.status !==
      'INVITED'
    ) {
      throw this.invalidStatus(
        'Only an active invited League War can be accepted.',
      );
    }

    await this.prisma.leagueWar.update({
      where: {
        id:
          warId,
      },
      data: {
        status:
          'ACCEPTED',
        acceptedAt:
          new Date(),
      },
    });

    return this.getWar(
      userId,
      warId,
    );
  }

  async rejectWar(
    userId: string,
    warId: string,
    reason?: string,
  ): Promise<any> {
    await this.expireInvites();

    const war =
      await this.requireWar(
        warId,
      );

    await this.assertLeagueAdmin(
      userId,
      war.awayLeagueId,
    );

    if (
      war.status !==
      'INVITED'
    ) {
      throw this.invalidStatus(
        'Only an invited League War can be rejected.',
      );
    }

    await this.prisma.leagueWar.update({
      where: {
        id:
          warId,
      },
      data: {
        status:
          'REJECTED',
        rejectedAt:
          new Date(),
        rejectionReason:
          reason?.trim() ||
          null,
      },
    });

    return this.getWar(
      userId,
      warId,
    );
  }

  async cancelWar(
    userId: string,
    warId: string,
    reason?: string,
  ): Promise<any> {
    const war =
      await this.requireWar(
        warId,
      );

    await this.assertLeagueAdmin(
      userId,
      war.homeLeagueId,
    );

    if (
      ![
        'INVITED',
        'ACCEPTED',
      ].includes(
        war.status,
      )
    ) {
      throw this.invalidStatus(
        'A League War can only be cancelled before it starts.',
      );
    }

    await this.prisma.leagueWar.update({
      where: {
        id:
          warId,
      },
      data: {
        status:
          'CANCELLED',
        cancelledAt:
          new Date(),
        cancellationReason:
          reason?.trim() ||
          null,
      },
    });

    return this.getWar(
      userId,
      warId,
    );
  }

  async rematch(
    userId: string,
    warId: string,
  ): Promise<any> {
    await this.expireInvites();

    const previous =
      await this.requireWar(
        warId,
      );

    if (
      ![
        'COMPLETED',
        'REJECTED',
        'CANCELLED',
        'EXPIRED',
      ].includes(
        previous.status,
      )
    ) {
      throw this.invalidStatus(
        'Rematch is available after a War is completed or closed.',
      );
    }

    const access =
      await this.accessFor(
        userId,
        previous,
      );

    if (
      access.adminLeagueIds.length ===
      0
    ) {
      throw this.permissionRequired();
    }

    const homeLeagueId =
      access.adminLeagueIds.includes(
        previous.homeLeagueId,
      )
        ? previous.homeLeagueId
        : previous.awayLeagueId;

    const awayLeagueId =
      homeLeagueId ===
      previous.homeLeagueId
        ? previous.awayLeagueId
        : previous.homeLeagueId;

    await this.assertNoActiveWar(
      homeLeagueId,
      awayLeagueId,
    );

    const homeLeague =
      homeLeagueId ===
      previous.homeLeagueId
        ? previous.homeLeague
        : previous.awayLeague;

    const awayLeague =
      awayLeagueId ===
      previous.awayLeagueId
        ? previous.awayLeague
        : previous.homeLeague;

    const challengeExpiresAt =
      new Date(
        Date.now() +
          48 *
            60 *
            60 *
            1000,
      );

    const war =
      await this.prisma.leagueWar.create({
        data: {
          name:
            `Rematch · ${homeLeague.name} vs ${awayLeague.name}`,
          homeLeagueId,
          awayLeagueId,
          createdByUserId:
            userId,
          rematchOfWarId:
            previous.id,
          playerCount:
            previous.playerCount,
          legType:
            previous.legType,
          pairingMode:
            previous.pairingMode,
          winPoints:
            previous.winPoints,
          drawPoints:
            previous.drawPoints,
          lossPoints:
            previous.lossPoints,
          challengeExpiresAt,
          status:
            'INVITED',
        },
      });

    return {
      success: true,
      data: {
        message:
          'Rematch challenge created.',
        war,
      },
      error: null,
    };
  }

  async setRoster(
    userId: string,
    warId: string,
    dto:
      SetLeagueWarRosterDto,
  ): Promise<any> {
    const war =
      await this.requireWar(
        warId,
      );

    if (
      war.status !==
      'ACCEPTED'
    ) {
      throw this.invalidStatus(
        'Rosters can be edited only after the challenge is accepted and before the War starts.',
      );
    }

    if (
      dto.leagueId !==
        war.homeLeagueId &&
      dto.leagueId !==
        war.awayLeagueId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_INVALID_SIDE',
          message:
            'The selected League is not part of this War.',
        },
      });
    }

    await this.assertLeagueAdmin(
      userId,
      dto.leagueId,
    );

    const isHome =
      dto.leagueId ===
      war.homeLeagueId;

    if (
      isHome
        ? war.homeReadyAt
        : war.awayReadyAt
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_ROSTER_LOCKED',
          message:
            'This roster is locked. Mark the League Not Ready before editing.',
        },
      });
    }

    const uniqueIds =
      [
        ...new Set(
          dto.userIds,
        ),
      ];

    if (
      uniqueIds.length !==
      dto.userIds.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_DUPLICATE_PLAYER',
          message:
            'A player can only occupy one roster slot.',
        },
      });
    }

    if (
      uniqueIds.length >
      war.playerCount
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_ROSTER_TOO_LARGE',
          message:
            `This War allows only ${war.playerCount} players per League.`,
        },
      });
    }

    const memberships =
      uniqueIds.length >
      0
        ? await this.prisma.leagueMember.findMany({
            where: {
              leagueId:
                dto.leagueId,
              userId: {
                in:
                  uniqueIds,
              },
            },
            select: {
              userId: true,
            },
          })
        : [];

    if (
      memberships.length !==
      uniqueIds.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_PLAYER_NOT_MEMBER',
          message:
            'Every selected player must be a member of that League.',
        },
      });
    }

    await this.prisma.$transaction(
      async (
        tx,
      ) => {
        await tx.leagueWarParticipant.deleteMany({
          where: {
            warId,
            leagueId:
              dto.leagueId,
          },
        });

        if (
          uniqueIds.length >
          0
        ) {
          await tx.leagueWarParticipant.createMany({
            data:
              uniqueIds.map(
                (
                  selectedUserId,
                  index,
                ) => ({
                  warId,
                  leagueId:
                    dto.leagueId,
                  userId:
                    selectedUserId,
                  slot:
                    index +
                    1,
                }),
              ),
          });
        }
      },
    );

    return this.getWar(
      userId,
      warId,
    );
  }

  async setReady(
    userId: string,
    warId: string,
    dto:
      SetLeagueWarReadyDto,
  ): Promise<any> {
    const war =
      await this.requireWar(
        warId,
      );

    if (
      war.status !==
      'ACCEPTED'
    ) {
      throw this.invalidStatus(
        'Ready status can only change before the War starts.',
      );
    }

    if (
      dto.leagueId !==
        war.homeLeagueId &&
      dto.leagueId !==
        war.awayLeagueId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_INVALID_SIDE',
          message:
            'The selected League is not part of this War.',
        },
      });
    }

    await this.assertLeagueAdmin(
      userId,
      dto.leagueId,
    );

    if (
      dto.ready
    ) {
      const count =
        await this.prisma.leagueWarParticipant.count({
          where: {
            warId,
            leagueId:
              dto.leagueId,
          },
        });

      if (
        count !==
        war.playerCount
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'LEAGUE_WAR_ROSTER_INCOMPLETE',
            message:
              `Select exactly ${war.playerCount} players before marking Ready.`,
          },
        });
      }
    }

    const now =
      dto.ready
        ? new Date()
        : null;

    await this.prisma.leagueWar.update({
      where: {
        id:
          warId,
      },
      data:
        dto.leagueId ===
        war.homeLeagueId
          ? {
              homeReadyAt:
                now,
              homeRosterLockedAt:
                now,
            }
          : {
              awayReadyAt:
                now,
              awayRosterLockedAt:
                now,
            },
    });

    return this.getWar(
      userId,
      warId,
    );
  }

  async startWar(
    userId: string,
    warId: string,
  ): Promise<any> {
    const war =
      await this.requireWar(
        warId,
      );

    await this.assertEitherLeagueAdmin(
      userId,
      war,
    );

    if (
      war.status !==
      'ACCEPTED'
    ) {
      throw this.invalidStatus(
        'The War must be accepted before it can start.',
      );
    }

    if (
      !war.homeReadyAt ||
      !war.awayReadyAt
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_BOTH_TEAMS_NOT_READY',
          message:
            'Both League admins must lock their roster and mark Ready before starting.',
        },
      });
    }

    if (
      war.scheduledStartAt &&
      new Date() <
        war.scheduledStartAt
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_START_NOT_REACHED',
          message:
            `This War is scheduled for ${war.scheduledStartAt.toISOString()}.`,
        },
      });
    }

    const participants =
      await this.prisma.leagueWarParticipant.findMany({
        where: {
          warId,
        },
        orderBy: {
          slot:
            'asc',
        },
      });

    const home =
      participants
        .filter(
          (
            row,
          ) =>
            row.leagueId ===
            war.homeLeagueId,
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.slot -
            second.slot,
        );

    let away =
      participants
        .filter(
          (
            row,
          ) =>
            row.leagueId ===
            war.awayLeagueId,
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.slot -
            second.slot,
        );

    if (
      home.length !==
        war.playerCount ||
      away.length !==
        war.playerCount
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_ROSTER_INCOMPLETE',
          message:
            `Both Leagues must lock exactly ${war.playerCount} players before starting.`,
        },
      });
    }

    if (
      war.pairingMode ===
      'RANDOM'
    ) {
      away =
        this.shuffle(
          away,
        );
    }

    const pairings:
      Array<{
        warId: string;
        sequence: number;
        leg: number;
        homePlayerUserId: string;
        awayPlayerUserId: string;
      }> =
      [];

    for (
      let index =
        0;
      index <
      war.playerCount;
      index +=
        1
    ) {
      pairings.push({
        warId,
        sequence:
          pairings.length +
          1,
        leg: 1,
        homePlayerUserId:
          home[index]
            .userId,
        awayPlayerUserId:
          away[index]
            .userId,
      });

      if (
        war.legType ===
        'HOME_AWAY'
      ) {
        pairings.push({
          warId,
          sequence:
            pairings.length +
            1,
          leg: 2,
          homePlayerUserId:
            away[index]
              .userId,
          awayPlayerUserId:
            home[index]
              .userId,
        });
      }
    }

    await this.prisma.$transaction(
      async (
        tx,
      ) => {
        await tx.leagueWarMatch.deleteMany({
          where: {
            warId,
          },
        });

        await tx.leagueWarMatch.createMany({
          data:
            pairings,
        });

        await tx.leagueWar.update({
          where: {
            id:
              warId,
          },
          data: {
            status:
              'LIVE',
            startedAt:
              new Date(),
          },
        });
      },
    );

    return this.getWar(
      userId,
      warId,
    );
  }

  async submitResult(
    userId: string,
    warId: string,
    matchId: string,
    dto:
      UpdateLeagueWarResultDto,
  ): Promise<any> {
    const war =
      await this.requireWar(
        warId,
      );

    const access =
      await this.accessFor(
        userId,
        war,
      );

    if (
      war.status !==
      'LIVE' ||
      access.adminLeagueIds.length ===
        0
    ) {
      throw this.permissionRequired();
    }

    const match =
      await this.requireMatch(
        warId,
        matchId,
      );

    const dualAdmin =
      access.isSuperAdmin ||
      (
        access.adminLeagueIds.includes(
          war.homeLeagueId,
        ) &&
        access.adminLeagueIds.includes(
          war.awayLeagueId,
        )
      );

    const submittingLeagueId =
      access.adminLeagueIds.includes(
        war.homeLeagueId,
      )
        ? war.homeLeagueId
        : war.awayLeagueId;

    await this.prisma.leagueWarMatch.update({
      where: {
        id:
          match.id,
      },
      data: {
        homeScore:
          dto.homeScore,
        awayScore:
          dto.awayScore,
        proofUrl:
          dto.proofUrl ??
          null,
        walkoverLeagueId:
          null,
        disputeReason:
          null,
        disputedAt:
          null,
        resultUpdatedByUserId:
          userId,
        resultSubmittedByUserId:
          userId,
        resultSubmittedByLeagueId:
          submittingLeagueId,
        submittedAt:
          new Date(),
        resultConfirmedByUserId:
          dualAdmin
            ? userId
            : null,
        confirmedAt:
          dualAdmin
            ? new Date()
            : null,
        status:
          dualAdmin
            ? 'COMPLETED'
            : 'SCHEDULED',
        resultStatus:
          dualAdmin
            ? 'CONFIRMED'
            : 'PENDING_CONFIRMATION',
        completedAt:
          dualAdmin
            ? new Date()
            : null,
      },
    });

    return this.getWar(
      userId,
      warId,
    );
  }

  async confirmResult(
    userId: string,
    warId: string,
    matchId: string,
  ): Promise<any> {
    const war =
      await this.requireWar(
        warId,
      );

    const access =
      await this.accessFor(
        userId,
        war,
      );

    const match =
      await this.requireMatch(
        warId,
        matchId,
      );

    if (
      ![
        'PENDING_CONFIRMATION',
        'WALKOVER_PENDING',
      ].includes(
        match.resultStatus,
      )
    ) {
      throw this.invalidStatus(
        'This result is not waiting for confirmation.',
      );
    }

    const allowed =
      access.isSuperAdmin ||
      (
        Boolean(
          match.resultSubmittedByLeagueId,
        ) &&
        access.adminLeagueIds.some(
          (
            leagueId,
          ) =>
            leagueId !==
            match.resultSubmittedByLeagueId,
        )
      );

    if (!allowed) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_OPPONENT_CONFIRMATION_REQUIRED',
          message:
            'The opposing League admin must confirm this result.',
        },
      });
    }

    await this.prisma.leagueWarMatch.update({
      where: {
        id:
          match.id,
      },
      data: {
        status:
          'COMPLETED',
        resultStatus:
          match.resultStatus ===
          'WALKOVER_PENDING'
            ? 'WALKOVER_CONFIRMED'
            : 'CONFIRMED',
        resultConfirmedByUserId:
          userId,
        confirmedAt:
          new Date(),
        completedAt:
          new Date(),
        disputeReason:
          null,
        disputedAt:
          null,
      },
    });

    return this.getWar(
      userId,
      warId,
    );
  }

  async disputeResult(
    userId: string,
    warId: string,
    matchId: string,
    reason: string,
  ): Promise<any> {
    const war =
      await this.requireWar(
        warId,
      );

    const access =
      await this.accessFor(
        userId,
        war,
      );

    const match =
      await this.requireMatch(
        warId,
        matchId,
      );

    if (
      ![
        'PENDING_CONFIRMATION',
        'WALKOVER_PENDING',
      ].includes(
        match.resultStatus,
      )
    ) {
      throw this.invalidStatus(
        'Only a pending result can be disputed.',
      );
    }

    const allowed =
      access.isSuperAdmin ||
      (
        Boolean(
          match.resultSubmittedByLeagueId,
        ) &&
        access.adminLeagueIds.some(
          (
            leagueId,
          ) =>
            leagueId !==
            match.resultSubmittedByLeagueId,
        )
      );

    if (!allowed) {
      throw this.permissionRequired();
    }

    await this.prisma.leagueWarMatch.update({
      where: {
        id:
          match.id,
      },
      data: {
        status:
          'SCHEDULED',
        resultStatus:
          'DISPUTED',
        disputeReason:
          reason.trim(),
        disputedAt:
          new Date(),
        resultConfirmedByUserId:
          null,
        confirmedAt:
          null,
        completedAt:
          null,
      },
    });

    return this.getWar(
      userId,
      warId,
    );
  }

  async submitWalkover(
    userId: string,
    warId: string,
    matchId: string,
    dto:
      LeagueWarWalkoverDto,
  ): Promise<any> {
    const war =
      await this.requireWar(
        warId,
      );

    const access =
      await this.accessFor(
        userId,
        war,
      );

    if (
      war.status !==
        'LIVE' ||
      access.adminLeagueIds.length ===
        0
    ) {
      throw this.permissionRequired();
    }

    if (
      dto.winnerLeagueId !==
        war.homeLeagueId &&
      dto.winnerLeagueId !==
        war.awayLeagueId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_INVALID_WALKOVER_WINNER',
          message:
            'Walkover winner must be one of the two Leagues.',
        },
      });
    }

    const match =
      await this.requireMatch(
        warId,
        matchId,
      );

    const matchHomeLeagueId =
      this.matchHomeLeagueId(
        war,
        match.leg,
      );

    const homeWins =
      dto.winnerLeagueId ===
      matchHomeLeagueId;

    const dualAdmin =
      access.isSuperAdmin ||
      (
        access.adminLeagueIds.includes(
          war.homeLeagueId,
        ) &&
        access.adminLeagueIds.includes(
          war.awayLeagueId,
        )
      );

    const submittingLeagueId =
      access.adminLeagueIds.includes(
        war.homeLeagueId,
      )
        ? war.homeLeagueId
        : war.awayLeagueId;

    await this.prisma.leagueWarMatch.update({
      where: {
        id:
          match.id,
      },
      data: {
        homeScore:
          homeWins
            ? 3
            : 0,
        awayScore:
          homeWins
            ? 0
            : 3,
        walkoverLeagueId:
          dto.winnerLeagueId,
        proofUrl:
          dto.proofUrl ??
          null,
        disputeReason:
          null,
        disputedAt:
          null,
        resultUpdatedByUserId:
          userId,
        resultSubmittedByUserId:
          userId,
        resultSubmittedByLeagueId:
          submittingLeagueId,
        submittedAt:
          new Date(),
        resultConfirmedByUserId:
          dualAdmin
            ? userId
            : null,
        confirmedAt:
          dualAdmin
            ? new Date()
            : null,
        status:
          dualAdmin
            ? 'COMPLETED'
            : 'SCHEDULED',
        resultStatus:
          dualAdmin
            ? 'WALKOVER_CONFIRMED'
            : 'WALKOVER_PENDING',
        completedAt:
          dualAdmin
            ? new Date()
            : null,
      },
    });

    return this.getWar(
      userId,
      warId,
    );
  }

  async completeWar(
    userId: string,
    warId: string,
  ): Promise<any> {
    const war =
      await this.requireWar(
        warId,
      );

    await this.assertEitherLeagueAdmin(
      userId,
      war,
    );

    if (
      war.status !==
      'LIVE'
    ) {
      throw this.invalidStatus(
        'Only a LIVE League War can be completed.',
      );
    }

    const matches =
      await this.prisma.leagueWarMatch.findMany({
        where: {
          warId,
        },
        orderBy: {
          sequence:
            'asc',
        },
      });

    if (
      matches.length ===
        0 ||
      matches.some(
        (
          match,
        ) =>
          match.status !==
            'COMPLETED' ||
          match.homeScore ===
            null ||
          match.awayScore ===
            null,
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_MATCHES_INCOMPLETE',
          message:
            'Every League War match must be confirmed before the War can be completed.',
        },
      });
    }

    const summary =
      this.summary(
        war,
        matches,
      );

    await this.prisma.leagueWar.update({
      where: {
        id:
          warId,
      },
      data: {
        status:
          'COMPLETED',
        winnerLeagueId:
          summary.leaderLeagueId,
        completedAt:
          new Date(),
      },
    });

    return this.getWar(
      userId,
      warId,
    );
  }

  private summary(
    war:
      WarCore,
    matches:
      Array<{
        leg?: number;
        status: string;
        homeScore:
          number | null;
        awayScore:
          number | null;
      }>,
  ) {
    const home:
      SideScore = {
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
      };

    const away:
      SideScore = {
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
      };

    let completedMatches =
      0;

    for (
      const match
      of matches
    ) {
      if (
        match.status !==
          'COMPLETED' ||
        match.homeScore ===
          null ||
        match.awayScore ===
          null
      ) {
        continue;
      }

      completedMatches +=
        1;

      const reversed =
        war.legType ===
          'HOME_AWAY' &&
        match.leg ===
          2;

      const homeLeagueScore =
        reversed
          ? match.awayScore
          : match.homeScore;

      const awayLeagueScore =
        reversed
          ? match.homeScore
          : match.awayScore;

      home.goalsFor +=
        homeLeagueScore;
      home.goalsAgainst +=
        awayLeagueScore;

      away.goalsFor +=
        awayLeagueScore;
      away.goalsAgainst +=
        homeLeagueScore;

      if (
        homeLeagueScore >
        awayLeagueScore
      ) {
        home.wins +=
          1;
        away.losses +=
          1;
        home.points +=
          war.winPoints;
        away.points +=
          war.lossPoints;
      } else if (
        homeLeagueScore <
        awayLeagueScore
      ) {
        away.wins +=
          1;
        home.losses +=
          1;
        away.points +=
          war.winPoints;
        home.points +=
          war.lossPoints;
      } else {
        home.draws +=
          1;
        away.draws +=
          1;
        home.points +=
          war.drawPoints;
        away.points +=
          war.drawPoints;
      }
    }

    home.goalDifference =
      home.goalsFor -
      home.goalsAgainst;
    away.goalDifference =
      away.goalsFor -
      away.goalsAgainst;

    let leaderLeagueId:
      string | null =
      null;

    const comparison = [
      home.points -
        away.points,
      home.goalDifference -
        away.goalDifference,
      home.goalsFor -
        away.goalsFor,
      home.wins -
        away.wins,
    ].find(
      (
        value,
      ) =>
        value !==
        0,
    );

    if (
      typeof comparison ===
      'number'
    ) {
      leaderLeagueId =
        comparison >
        0
          ? war.homeLeagueId
          : war.awayLeagueId;
    }

    return {
      completedMatches,
      totalMatches:
        matches.length,
      remainingMatches:
        Math.max(
          0,
          matches.length -
            completedMatches,
        ),
      home,
      away,
      leaderLeagueId,
      tieBreakOrder: [
        'WAR_POINTS',
        'GOAL_DIFFERENCE',
        'GOALS_SCORED',
        'WINS',
        'DRAW',
      ],
    };
  }

  private playerStats(
    matches:
      Array<any>,
  ) {
    const map =
      new Map<
        string,
        {
          userId: string;
          fullName: string;
          inGameName:
            string | null;
          playerCode:
            string | null;
          matches: number;
          wins: number;
          draws: number;
          losses: number;
          goalsFor: number;
          goalsAgainst: number;
          goalDifference: number;
          winRate: number;
        }
      >();

    const add =
      (
        user:
          any,
        scored:
          number,
        conceded:
          number,
      ) => {
        let row =
          map.get(
            user.id,
          );

        if (!row) {
          row = {
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
              null,
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            winRate: 0,
          };
          map.set(
            user.id,
            row,
          );
        }

        row.matches +=
          1;
        row.goalsFor +=
          scored;
        row.goalsAgainst +=
          conceded;

        if (
          scored >
          conceded
        ) {
          row.wins +=
            1;
        } else if (
          scored <
          conceded
        ) {
          row.losses +=
            1;
        } else {
          row.draws +=
            1;
        }

        row.goalDifference =
          row.goalsFor -
          row.goalsAgainst;
        row.winRate =
          Number(
            (
              (row.wins /
                row.matches) *
              100
            ).toFixed(
              1,
            ),
          );
      };

    for (
      const match
      of matches
    ) {
      if (
        match.status !==
          'COMPLETED' ||
        match.homeScore ===
          null ||
        match.awayScore ===
          null
      ) {
        continue;
      }

      add(
        match.homePlayer,
        match.homeScore,
        match.awayScore,
      );

      add(
        match.awayPlayer,
        match.awayScore,
        match.homeScore,
      );
    }

    return Array.from(
      map.values(),
    )
      .sort(
        (
          first,
          second,
        ) =>
          second.wins -
            first.wins ||
          second.goalDifference -
            first.goalDifference ||
          second.goalsFor -
            first.goalsFor ||
          first.losses -
            second.losses,
      )
      .map(
        (
          row,
          index,
        ) => ({
          position:
            index +
            1,
          ...row,
        }),
      );
  }

  private rivalrySummary(
    current:
      any,
    wars:
      Array<any>,
  ) {
    let homeWins =
      0;
    let awayWins =
      0;
    let draws =
      0;
    let homeBattlePoints =
      0;
    let awayBattlePoints =
      0;

    for (
      const war
      of wars
    ) {
      const summary =
        this.summary(
          war,
          war.matches,
        );

      const currentHomeWasHome =
        war.homeLeagueId ===
        current.homeLeagueId;

      const currentHomePoints =
        currentHomeWasHome
          ? summary.home.points
          : summary.away.points;

      const currentAwayPoints =
        currentHomeWasHome
          ? summary.away.points
          : summary.home.points;

      homeBattlePoints +=
        currentHomePoints;
      awayBattlePoints +=
        currentAwayPoints;

      if (
        war.winnerLeagueId ===
        current.homeLeagueId
      ) {
        homeWins +=
          1;
      } else if (
        war.winnerLeagueId ===
        current.awayLeagueId
      ) {
        awayWins +=
          1;
      } else {
        draws +=
          1;
      }
    }

    return {
      previousWars:
        wars.length,
      homeWins,
      awayWins,
      draws,
      homeBattlePoints,
      awayBattlePoints,
      recent:
        wars
          .slice(
            0,
            5,
          )
          .map(
            (
              war,
            ) => ({
              id:
                war.id,
              name:
                war.name,
              completedAt:
                war.completedAt,
              winnerLeagueId:
                war.winnerLeagueId,
            }),
          ),
    };
  }

  private matchHomeLeagueId(
    war:
      {
        homeLeagueId: string;
        awayLeagueId: string;
        legType: string;
      },
    leg: number,
  ) {
    return war.legType ===
      'HOME_AWAY' &&
      leg ===
        2
      ? war.awayLeagueId
      : war.homeLeagueId;
  }

  private async requireWar(
    warId: string,
  ) {
    const war =
      await this.prisma.leagueWar.findUnique({
        where: {
          id:
            warId,
        },
        include: {
          homeLeague: {
            select: {
              id: true,
              name: true,
              code: true,
              logoUrl: true,
            },
          },
          awayLeague: {
            select: {
              id: true,
              name: true,
              code: true,
              logoUrl: true,
            },
          },
        },
      });

    if (!war) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_NOT_FOUND',
          message:
            'League War could not be found.',
        },
      });
    }

    return war;
  }

  private async requireMatch(
    warId: string,
    matchId: string,
  ) {
    const match =
      await this.prisma.leagueWarMatch.findUnique({
        where: {
          id:
            matchId,
        },
      });

    if (
      !match ||
      match.warId !==
      warId
    ) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_MATCH_NOT_FOUND',
          message:
            'League War match could not be found.',
        },
      });
    }

    return match;
  }

  private async accessFor(
    userId: string,
    war:
      Pick<
        WarCore,
        | 'homeLeagueId'
        | 'awayLeagueId'
      >,
  ): Promise<AccessState> {
    const [
      user,
      memberships,
      admins,
    ] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: {
            id:
              userId,
          },
          select: {
            role: true,
          },
        }),
        this.prisma.leagueMember.findMany({
          where: {
            userId,
            leagueId: {
              in: [
                war.homeLeagueId,
                war.awayLeagueId,
              ],
            },
          },
          select: {
            leagueId: true,
          },
        }),
        this.prisma.leagueAdmin.findMany({
          where: {
            userId,
            leagueId: {
              in: [
                war.homeLeagueId,
                war.awayLeagueId,
              ],
            },
          },
          select: {
            leagueId: true,
          },
        }),
      ]);

    const isSuperAdmin =
      user?.role ===
      'SUPER_ADMIN';

    return {
      canView:
        isSuperAdmin ||
        memberships.length >
          0 ||
        admins.length >
          0,
      isSuperAdmin,
      adminLeagueIds:
        isSuperAdmin
          ? [
              war.homeLeagueId,
              war.awayLeagueId,
            ]
          : admins.map(
              (
                row,
              ) =>
                row.leagueId,
            ),
    };
  }

  private async assertLeagueAdmin(
    userId: string,
    leagueId: string,
  ) {
    const [
      user,
      admin,
    ] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: {
            id:
              userId,
          },
          select: {
            role: true,
          },
        }),
        this.prisma.leagueAdmin.findUnique({
          where: {
            leagueId_userId: {
              leagueId,
              userId,
            },
          },
        }),
      ]);

    if (
      user?.role !==
        'SUPER_ADMIN' &&
      !admin
    ) {
      throw this.permissionRequired();
    }
  }

  private async assertEitherLeagueAdmin(
    userId: string,
    war:
      Pick<
        WarCore,
        | 'homeLeagueId'
        | 'awayLeagueId'
      >,
  ) {
    const access =
      await this.accessFor(
        userId,
        war,
      );

    if (
      access.adminLeagueIds
        .length ===
      0
    ) {
      throw this.permissionRequired();
    }
  }

  private async assertNoActiveWar(
    firstLeagueId:
      string,
    secondLeagueId:
      string,
  ) {
    const existing =
      await this.prisma.leagueWar.findFirst({
        where: {
          status: {
            in: [
              'INVITED',
              'ACCEPTED',
              'LIVE',
            ],
          },
          OR: [
            {
              homeLeagueId:
                firstLeagueId,
              awayLeagueId:
                secondLeagueId,
            },
            {
              homeLeagueId:
                secondLeagueId,
              awayLeagueId:
                firstLeagueId,
            },
          ],
        },
        select: {
          id: true,
          name: true,
        },
      });

    if (existing) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_ALREADY_ACTIVE',
          message:
            `An active League War already exists between these Leagues: ${existing.name}.`,
        },
      });
    }
  }

  private async expireInvites() {
    await this.prisma.leagueWar.updateMany({
      where: {
        status:
          'INVITED',
        challengeExpiresAt: {
          lt:
            new Date(),
        },
      },
      data: {
        status:
          'EXPIRED',
      },
    });
  }

  private playerSelect() {
    return {
      id: true,
      fullName: true,
      player: {
        select: {
          playerCode: true,
          profileImageUrl: true,
          identity: {
            select: {
              inGameName: true,
            },
          },
        },
      },
    } as const;
  }

  private serializePlayer(
    user:
      any,
  ) {
    return {
      id:
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
        null,
      profileImageUrl:
        user.player
          ?.profileImageUrl ??
        null,
    };
  }

  private shuffle<T>(
    rows: T[],
  ) {
    const copy =
      [
        ...rows,
      ];

    for (
      let index =
        copy.length -
        1;
      index >
      0;
      index -=
        1
    ) {
      const target =
        Math.floor(
          Math.random() *
            (index +
              1),
        );

      [
        copy[index],
        copy[target],
      ] = [
        copy[target],
        copy[index],
      ];
    }

    return copy;
  }

  private permissionRequired() {
    return new ForbiddenException({
      success: false,
      data: null,
      error: {
        code:
          'LEAGUE_WAR_ADMIN_REQUIRED',
        message:
          'League owner or admin permission is required.',
      },
    });
  }

  private invalidStatus(
    message: string,
  ) {
    return new ConflictException({
      success: false,
      data: null,
      error: {
        code:
          'LEAGUE_WAR_INVALID_STATUS',
        message,
      },
    });
  }
}
