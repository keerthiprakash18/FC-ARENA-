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
  SetLeagueWarRosterDto,
  UpdateLeagueWarResultDto,
} from './dto/league-war.dto.js';

type WarCore = {
  homeLeagueId: string;
  awayLeagueId: string;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
};

interface SideScore {
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

@Injectable()
export class LeagueWarsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async getWars(
    userId: string,
  ) {
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
                      in: leagueIds,
                    },
                  },
                  {
                    awayLeagueId: {
                      in: leagueIds,
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
              status: true,
              homeScore: true,
              awayScore: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 100,
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
              winPoints:
                war.winPoints,
              drawPoints:
                war.drawPoints,
              lossPoints:
                war.lossPoints,
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

  async createWar(
    userId: string,
    dto:
      CreateLeagueWarDto,
  ) {
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
                home.id,
              awayLeagueId:
                opponent.id,
            },
            {
              homeLeagueId:
                opponent.id,
              awayLeagueId:
                home.id,
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
          winPoints:
            dto.winPoints ??
            3,
          drawPoints:
            dto.drawPoints ??
            1,
          lossPoints:
            dto.lossPoints ??
            0,
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
  ) {
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
              select: {
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
              },
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
              select: {
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
              },
            },
            awayPlayer: {
              select: {
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
              },
            },
          },
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
                in: manageableIds,
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
                select: {
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
                },
              },
            },
          })
        : [];

    const serialize =
      (
        user:
          any,
      ) => ({
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
      });

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
          winPoints:
            war.winPoints,
          drawPoints:
            war.drawPoints,
          lossPoints:
            war.lossPoints,
          acceptedAt:
            war.acceptedAt,
          startedAt:
            war.startedAt,
          completedAt:
            war.completedAt,
          winnerLeagueId:
            war.winnerLeagueId,
          homeLeague:
            war.homeLeague,
          awayLeague:
            war.awayLeague,
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
            canStart:
              war.status ===
                'ACCEPTED' &&
              access.adminLeagueIds.length >
                0,
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
              ) => ({
                id:
                  match.id,
                sequence:
                  match.sequence,
                leg:
                  match.leg,
                status:
                  match.status,
                homeScore:
                  match.homeScore,
                awayScore:
                  match.awayScore,
                completedAt:
                  match.completedAt,
                homePlayer:
                  serialize(
                    match.homePlayer,
                  ),
                awayPlayer:
                  serialize(
                    match.awayPlayer,
                  ),
              }),
            ),
          summary:
            this.summary(
              war,
              matches,
            ),
        },
      },
      error: null,
    };
  }

  async acceptWar(
    userId: string,
    warId: string,
  ) {
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
        'Only an invited League War can be accepted.',
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

  async setRoster(
    userId: string,
    warId: string,
    dto:
      SetLeagueWarRosterDto,
  ) {
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

  async startWar(
    userId: string,
    warId: string,
  ) {
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

    const away =
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
            home[index]
              .userId,
          awayPlayerUserId:
            away[index]
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

  async updateResult(
    userId: string,
    warId: string,
    matchId: string,
    dto:
      UpdateLeagueWarResultDto,
  ) {
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
        'Results can be entered only while the League War is LIVE.',
      );
    }

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

    await this.prisma.leagueWarMatch.update({
      where: {
        id:
          matchId,
      },
      data: {
        homeScore:
          dto.homeScore,
        awayScore:
          dto.awayScore,
        status:
          'COMPLETED',
        resultUpdatedByUserId:
          userId,
        completedAt:
          new Date(),
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
  ) {
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
            'Every League War match must have a completed result first.',
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

      home.goalsFor +=
        match.homeScore;
      home.goalsAgainst +=
        match.awayScore;
      away.goalsFor +=
        match.awayScore;
      away.goalsAgainst +=
        match.homeScore;

      if (
        match.homeScore >
        match.awayScore
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
        match.homeScore <
        match.awayScore
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

  private async accessFor(
    userId: string,
    war:
      Pick<
        WarCore,
        | 'homeLeagueId'
        | 'awayLeagueId'
      >,
  ) {
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
