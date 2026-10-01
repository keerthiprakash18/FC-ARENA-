import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import type {
  SetMatchReadyDto,
} from './dto/set-match-ready.dto.js';

import {
  MatchRealtimeService,
} from './match-realtime.service.js';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly realtime:
      MatchRealtimeService,
  ) {}

  async getMatch(
    userId: string,
    matchId: string,
  ) {
    const access =
      await this.getMatchAccess(
        userId,
        matchId,
      );

    const {
      match,
      admin,
      participantSide,
      isParticipant,
    } =
      access;

    const homeSource =
      match.fixture.previousFixtures.find(
        (
          fixture,
        ) =>
          fixture.nextSlot ===
          'HOME',
      );

    const awaySource =
      match.fixture.previousFixtures.find(
        (
          fixture,
        ) =>
          fixture.nextSlot ===
          'AWAY',
      );

    const estimatedDeadlineAt =
      match.fixture.scheduledAt
        ? new Date(
            match.fixture.scheduledAt.getTime() +
              match.tournament
                .matchDurationMinutes *
                60_000,
          )
        : null;

    return {
      success: true,

      data: {
        match: {
          id:
            match.id,

          matchCode:
            match.matchCode,

          status:
            match.status,

          isLeagueAdmin:
            Boolean(
              admin,
            ),

          isParticipant,

          participantSide,

          readiness: {
            homeReadyAt:
              match.homeReadyAt,

            awayReadyAt:
              match.awayReadyAt,

            homeReady:
              Boolean(
                match.homeReadyAt,
              ),

            awayReady:
              Boolean(
                match.awayReadyAt,
              ),

            bothReady:
              Boolean(
                match.homeReadyAt &&
                match.awayReadyAt,
              ),
          },

          schedule: {
            scheduledAt:
              match.fixture.scheduledAt,

            estimatedDeadlineAt,

            matchDurationMinutes:
              match.tournament
                .matchDurationMinutes,
          },

          tournament: {
            id:
              match.tournament.id,

            name:
              match.tournament.name,

            mode:
              match.tournament.mode,

            format:
              match.tournament.format,
          },

          league:
            match.tournament.league,

          fixture: {
            id:
              match.fixture.id,

            fixtureCode:
              match.fixture.fixtureCode,

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

            status:
              match.fixture.status,

            home:
              this.mapEntry(
                match.fixture
                  .homeRegistration,
              ),

            away:
              this.mapEntry(
                match.fixture
                  .awayRegistration,
              ),

            homeSource:
              homeSource
                ? homeSource.fixtureCode
                : null,

            awaySource:
              awaySource
                ? awaySource.fixtureCode
                : null,
          },
        },
      },

      error: null,
    };
  }

  async setReady(
    userId: string,
    matchId: string,
    dto:
      SetMatchReadyDto,
  ) {
    const {
      match,
      admin,
      participantSide,
    } =
      await this.getMatchAccess(
        userId,
        matchId,
      );

    if (
      ![
        'UNSCHEDULED',
        'SCHEDULED',
      ].includes(
        match.status,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'MATCH_READY_LOCKED',
          message:
            'Ready status can only change before the match starts.',
        },
      });
    }

    if (
      !match.fixture
        .homeRegistration ||
      !match.fixture
        .awayRegistration
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'MATCH_PARTICIPANTS_NOT_READY',
          message:
            'Both match participants must be resolved before Ready can be set.',
        },
      });
    }

    let side =
      participantSide;

    if (
      dto.side
    ) {
      if (
        !admin &&
        participantSide !==
          dto.side
      ) {
        throw new ForbiddenException({
          success: false,
          data: null,
          error: {
            code:
              'MATCH_READY_SIDE_FORBIDDEN',
            message:
              'Players may only change Ready for their own side.',
          },
        });
      }

      side =
        dto.side;
    }

    if (!side) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'MATCH_READY_SIDE_REQUIRED',
          message:
            'Only a participant can mark Ready. League Admins must choose HOME or AWAY.',
        },
      });
    }

    const now =
      dto.ready
        ? new Date()
        : null;

    const updated =
      await this.prisma.match.update({
        where: {
          id:
            matchId,
        },

        data:
          side ===
          'HOME'
            ? {
                homeReadyAt:
                  now,
              }
            : {
                awayReadyAt:
                  now,
              },

        select: {
          id: true,
          homeReadyAt: true,
          awayReadyAt: true,
        },
      });

    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          userId,

        action:
          dto.ready
            ? 'MATCH_SIDE_READY'
            : 'MATCH_SIDE_NOT_READY',

        targetType:
          'Match',

        targetId:
          matchId,

        scopeType:
          'LEAGUE',

        scopeId:
          match.tournament
            .leagueId,

        metadata: {
          side,
        },
      },
    });

    this.realtime.publish(
      matchId,
      'ready_changed',
      {
        side,
        ready:
          dto.ready,
        homeReady:
          Boolean(
            updated.homeReadyAt,
          ),
        awayReady:
          Boolean(
            updated.awayReadyAt,
          ),
      },
    );

    return {
      success: true,

      data: {
        message:
          dto.ready
            ? `${side} side is Ready to Play.`
            : `${side} side Ready status was cleared.`,

        readiness: {
          homeReadyAt:
            updated.homeReadyAt,

          awayReadyAt:
            updated.awayReadyAt,

          homeReady:
            Boolean(
              updated.homeReadyAt,
            ),

          awayReady:
            Boolean(
              updated.awayReadyAt,
            ),

          bothReady:
            Boolean(
              updated.homeReadyAt &&
              updated.awayReadyAt,
            ),
        },
      },

      error: null,
    };
  }

  async assertRealtimeAccess(
    userId: string,
    matchId: string,
  ) {
    await this.getMatchAccess(
      userId,
      matchId,
    );
  }

  private async getMatchAccess(
    userId: string,
    matchId: string,
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: {
          id:
            matchId,
        },

        include: {
          tournament: {
            include: {
              league: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
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

              previousFixtures: {
                select: {
                  fixtureCode: true,
                  nextSlot: true,
                },
              },
            },
          },
        },
      });

    if (!match) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'MATCH_NOT_FOUND',

          message:
            'Match could not be found.',
        },
      });
    }

    const membership =
      await this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              match.tournament
                .leagueId,

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
            'You must be a League member to access this Match Room.',
        },
      });
    }

    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              match.tournament
                .leagueId,

            userId,
          },
        },
      });

    const homeUserIds =
      match.fixture
        .homeRegistration
        ?.members.map(
          (
            member,
          ) =>
            member.user.id,
        ) ??
      [];

    const awayUserIds =
      match.fixture
        .awayRegistration
        ?.members.map(
          (
            member,
          ) =>
            member.user.id,
        ) ??
      [];

    const participantSide:
      | 'HOME'
      | 'AWAY'
      | null =
      homeUserIds.includes(
        userId,
      )
        ? 'HOME'
        : awayUserIds.includes(
              userId,
            )
          ? 'AWAY'
          : null;

    return {
      match,
      admin,
      participantSide,
      isParticipant:
        participantSide !==
        null,
    };
  }

  private mapEntry(
    registration:
      any,
  ) {
    if (!registration) {
      return null;
    }

    return {
      id:
        registration.id,

      entryName:
        registration.entryName,

      members:
        registration.members.map(
          (
            member:
              any,
          ) => ({
            id:
              member.user.id,

            fullName:
              member.user.fullName,

            playerCode:
              member.user.player
                ?.playerCode ??
              null,

            inGameName:
              member.user.player
                ?.identity
                ?.inGameName ??
              null,
          }),
        ),
    };
  }
}
