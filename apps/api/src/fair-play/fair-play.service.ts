import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  AuthorizationService,
} from '../security/authorization.service.js';

import type {
  CreateFairPlayAppealDto,
} from './dto/create-fair-play-appeal.dto.js';

import type {
  IssueFairPlayEventDto,
} from './dto/issue-fair-play-event.dto.js';

import type {
  ResolveFairPlayAppealDto,
} from './dto/resolve-fair-play-appeal.dto.js';

import type {
  RevokeFairPlayEventDto,
} from './dto/revoke-fair-play-event.dto.js';

const FAIR_PLAY_POLICY = {
  COMMENDATION: {
    points:
      2,
    days:
      90,
    title:
      'Fair Play Commendation',
  },

  WARNING: {
    points:
      0,
    days:
      30,
    title:
      'Fair Play Warning',
  },

  LATE_RESULT: {
    points:
      -2,
    days:
      30,
    title:
      'Late Result',
  },

  NO_SHOW: {
    points:
      -8,
    days:
      90,
    title:
      'No Show',
  },

  RESULT_INTEGRITY: {
    points:
      -15,
    days:
      180,
    title:
      'Result Integrity',
  },

  CONDUCT: {
    points:
      -10,
    days:
      180,
    title:
      'Conduct Incident',
  },

  OTHER: {
    points:
      -5,
    days:
      90,
    title:
      'Fair Play Incident',
  },
} as const;

type FairPlayKind =
  keyof typeof FAIR_PLAY_POLICY;

@Injectable()
export class FairPlayService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly authorization:
      AuthorizationService,
  ) {}

  async getMyFairPlay(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const [
      summary,
      events,
    ] =
      await Promise.all([
        this.summaryForUser(
          userId,
        ),

        this.prisma.fairPlayEvent.findMany({
          where: {
            userId,
          },

          include: {
            league: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },

            issuedBy: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    playerCode:
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

            revokedBy: {
              select: {
                id: true,
                fullName: true,
              },
            },

            appeals: {
              where: {
                appealedByUserId:
                  userId,
              },

              select: {
                id: true,
                reason: true,
                status: true,
                resolutionNote:
                  true,
                resolvedAt:
                  true,
                createdAt:
                  true,
              },

              orderBy: {
                createdAt:
                  'desc',
              },
            },
          },

          orderBy: {
            issuedAt:
              'desc',
          },

          take: 100,
        }),
      ]);

    return {
      success: true,

      data: {
        summary,

        policy:
          this.publicPolicy(),

        events:
          events.map(
            (
              event,
            ) => ({
              id:
                event.id,
              kind:
                event.kind,
              pointsDelta:
                event.pointsDelta,
              title:
                event.title,
              reason:
                event.reason,
              evidenceUrl:
                event.evidenceUrl,
              issuedAt:
                event.issuedAt,
              expiresAt:
                event.expiresAt,
              revokedAt:
                event.revokedAt,
              revocationNote:
                event.revocationNote,

              active:
                this.isEventActive(
                  event,
                ),

              league:
                event.league,

              issuedBy: {
                id:
                  event.issuedBy.id,
                name:
                  event
                    .issuedBy
                    .player
                    ?.identity
                    ?.inGameName ??
                  event
                    .issuedBy
                    .fullName,
                playerCode:
                  event
                    .issuedBy
                    .player
                    ?.playerCode ??
                  null,
              },

              appeal:
                event.appeals[0] ??
                null,
            }),
          ),
      },

      error: null,
    };
  }

  async getPublicSummary(
    requesterUserId: string,
    targetUserId: string,
  ) {
    await this.assertActiveUser(
      requesterUserId,
    );

    await this.assertActiveUser(
      targetUserId,
    );

    const summary =
      await this.summaryForUser(
        targetUserId,
      );

    return {
      success: true,

      data: {
        fairPlay: {
          score:
            summary.score,
          status:
            summary.status,
          activePenaltyEvents:
            summary.activePenaltyEvents,
          commendations:
            summary.commendations,
          lastUpdatedAt:
            summary.lastUpdatedAt,
          detailVisibility:
            requesterUserId ===
            targetUserId
              ? 'SELF'
              : 'SUMMARY_ONLY',
        },

        policy: {
          baseScore:
            100,
          note:
            'Fair Play details are private. Public profiles only show the summary. Reports and disputes do not reduce this score automatically.',
        },
      },

      error: null,
    };
  }

  async getLeagueMembersForAdmin(
    adminUserId: string,
    leagueId: string,
    rawSearch?: string,
  ) {
    await this.authorization.assertLeagueAdmin(
      adminUserId,
      leagueId,
    );

    const search =
      rawSearch
        ?.trim()
        .slice(
          0,
          80,
        );

    const members =
      await this.prisma.leagueMember.findMany({
        where: {
          leagueId,

          ...(search
            ? {
                user: {
                  OR: [
                    {
                      fullName: {
                        contains:
                          search,
                        mode:
                          'insensitive',
                      },
                    },
                    {
                      player: {
                        is: {
                          playerCode: {
                            contains:
                              search,
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
                                  search,
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
              }
            : {}),
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
                      isVerified:
                        true,
                    },
                  },
                },
              },

              leagueAdminRoles: {
                where: {
                  leagueId,
                },

                select: {
                  role: true,
                },

                take: 1,
              },
            },
          },
        },

        orderBy: {
          joinedAt:
            'asc',
        },

        take: 100,
      });

    return {
      success: true,

      data: {
        members:
          members.map(
            (
              membership,
            ) => ({
              membershipId:
                membership.id,
              membershipType:
                membership.type,
              joinedAt:
                membership.joinedAt,

              user: {
                id:
                  membership.user.id,
                fullName:
                  membership.user
                    .fullName,
                playerCode:
                  membership.user
                    .player
                    ?.playerCode ??
                  null,
                profileImageUrl:
                  membership.user
                    .player
                    ?.profileImageUrl ??
                  null,
                inGameName:
                  membership.user
                    .player
                    ?.identity
                    ?.inGameName ??
                  null,
                identityVerified:
                  membership.user
                    .player
                    ?.identity
                    ?.isVerified ??
                  false,
                adminRole:
                  membership.user
                    .leagueAdminRoles[0]
                    ?.role ??
                  null,
              },
            }),
          ),
      },

      error: null,
    };
  }

  async issueEvent(
    adminUserId: string,
    dto:
      IssueFairPlayEventDto,
  ) {
    const isSuperAdmin =
      await this.authorization.isSuperAdmin(
        adminUserId,
      );

    await this.authorization.assertLeagueAdmin(
      adminUserId,
      dto.leagueId,
    );

    const targetMembership =
      await this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              dto.leagueId,
            userId:
              dto.targetUserId,
          },
        },

        select: {
          id: true,
        },
      });

    if (
      !targetMembership
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_TARGET_NOT_IN_LEAGUE',

          message:
            'Fair Play events can only be issued for a current member of the selected League.',
        },
      });
    }

    if (
      adminUserId ===
        dto.targetUserId &&
      !isSuperAdmin
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_SELF_ACTION_FORBIDDEN',

          message:
            'League Admins cannot issue Fair Play events to themselves.',
        },
      });
    }

    const policy =
      FAIR_PLAY_POLICY[
        dto.kind as
          FairPlayKind
      ];

    const issuedAt =
      new Date();

    const expiresAt =
      new Date(
        issuedAt.getTime() +
          policy.days *
            24 *
            60 *
            60 *
            1000,
      );

    const event =
      await this.prisma.fairPlayEvent.create({
        data: {
          userId:
            dto.targetUserId,
          leagueId:
            dto.leagueId,
          kind:
            dto.kind,
          pointsDelta:
            policy.points,
          title:
            policy.title,
          reason:
            dto.reason.trim(),
          evidenceUrl:
            dto.evidenceUrl
              ?.trim() ||
            null,
          issuedByUserId:
            adminUserId,
          issuedAt,
          expiresAt,
        },

        include: {
          league: {
            select: {
              name: true,
            },
          },
        },
      });

    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          adminUserId,
        action:
          'FAIR_PLAY_EVENT_ISSUED',
        targetType:
          'FairPlayEvent',
        targetId:
          event.id,
        scopeType:
          'LEAGUE',
        scopeId:
          dto.leagueId,
        metadata: {
          targetUserId:
            dto.targetUserId,
          kind:
            event.kind,
          pointsDelta:
            event.pointsDelta,
          expiresAt:
            event.expiresAt,
        },
      },
    });

    await this.notify(
      dto.targetUserId,
      {
        title:
          policy.points <
          0
            ? 'Fair Play Record Updated'
            : policy.points >
                0
              ? 'Fair Play Commendation'
              : 'Fair Play Warning',

        message:
          policy.points ===
          0
            ? `${event.league.name}: ${event.title}. Open Fair Play to review the reason.`
            : `${event.league.name}: ${event.title} (${policy.points > 0 ? '+' : ''}${policy.points}). Open Fair Play for details or appeal options.`,

        href:
          '/fair-play',

        entityId:
          event.id,

        dedupeKey:
          `fair-play-event:${event.id}`,
      },
    );

    return {
      success: true,

      data: {
        message:
          'Fair Play event recorded with the fixed FC Arena policy value.',

        event: {
          id:
            event.id,
          kind:
            event.kind,
          pointsDelta:
            event.pointsDelta,
          expiresAt:
            event.expiresAt,
        },
      },

      error: null,
    };
  }

  async createAppeal(
    userId: string,
    eventId: string,
    dto:
      CreateFairPlayAppealDto,
  ) {
    const event =
      await this.prisma.fairPlayEvent.findUnique({
        where: {
          id:
            eventId,
        },

        include: {
          league: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (
      !event ||
      event.userId !==
        userId
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_EVENT_NOT_FOUND',

          message:
            'Fair Play event could not be found.',
        },
      });
    }

    if (
      event.kind ===
        'COMMENDATION'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_APPEAL_NOT_REQUIRED',

          message:
            'A positive Fair Play commendation does not require an appeal.',
        },
      });
    }

    if (
      event.revokedAt
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_EVENT_ALREADY_REVOKED',

          message:
            'This Fair Play event has already been revoked.',
        },
      });
    }

    const existing =
      await this.prisma.fairPlayAppeal.findUnique({
        where: {
          eventId_appealedByUserId: {
            eventId:
              event.id,
            appealedByUserId:
              userId,
          },
        },
      });

    if (
      existing
    ) {
      return {
        success: true,

        data: {
          message:
            'An appeal already exists for this Fair Play event.',
          appeal:
            existing,
        },

        error: null,
      };
    }

    const appeal =
      await this.prisma.fairPlayAppeal.create({
        data: {
          eventId:
            event.id,
          appealedByUserId:
            userId,
          reason:
            dto.reason.trim(),
        },
      });

    const admins =
      await this.prisma.leagueAdmin.findMany({
        where: {
          leagueId:
            event.leagueId,
        },

        select: {
          userId: true,
        },
      });

    await Promise.all(
      admins.map(
        (
          admin,
        ) =>
          this.notify(
            admin.userId,
            {
              title:
                'Fair Play Appeal',
              message:
                `A player appealed a Fair Play event in ${event.league.name}.`,
              href:
                '/admin/fair-play',
              entityId:
                appeal.id,
              dedupeKey:
                `fair-play-appeal:${appeal.id}:${admin.userId}`,
            },
          ),
      ),
    );

    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          userId,
        action:
          'FAIR_PLAY_APPEAL_CREATED',
        targetType:
          'FairPlayAppeal',
        targetId:
          appeal.id,
        scopeType:
          'LEAGUE',
        scopeId:
          event.leagueId,
        metadata: {
          fairPlayEventId:
            event.id,
        },
      },
    });

    return {
      success: true,

      data: {
        message:
          'Fair Play appeal submitted.',
        appeal,
      },

      error: null,
    };
  }

  async getAdminQueue(
    adminUserId: string,
    rawLeagueId?: string,
  ) {
    const scope =
      await this.adminLeagueScope(
        adminUserId,
      );

    const leagueId =
      rawLeagueId?.trim() ||
      null;

    if (
      leagueId &&
      !scope.superAdmin &&
      !scope.leagueIds.includes(
        leagueId,
      )
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_LEAGUE_FORBIDDEN',

          message:
            'You cannot manage Fair Play for this League.',
        },
      });
    }

    const leagueIds =
      leagueId
        ? [
            leagueId,
          ]
        : scope.superAdmin
          ? undefined
          : scope.leagueIds;

    const [
      events,
      appeals,
      leagues,
    ] =
      await Promise.all([
        this.prisma.fairPlayEvent.findMany({
          where:
            leagueIds
              ? {
                  leagueId: {
                    in:
                      leagueIds,
                  },
                }
              : {},

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

            league: {
              select: {
                id: true,
                name: true,
              },
            },

            issuedBy: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
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

            appeals: {
              orderBy: {
                createdAt:
                  'desc',
              },

              take: 1,
            },
          },

          orderBy: {
            issuedAt:
              'desc',
          },

          take: 200,
        }),

        this.prisma.fairPlayAppeal.findMany({
          where: {
            status:
              'PENDING',

            event:
              leagueIds
                ? {
                    leagueId: {
                      in:
                        leagueIds,
                    },
                  }
                : {},
          },

          include: {
            appealedBy: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    playerCode:
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

            event: {
              include: {
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
            createdAt:
              'asc',
          },

          take: 100,
        }),

        this.prisma.league.findMany({
          where:
            leagueIds
              ? {
                  id: {
                    in:
                      leagueIds,
                  },
                }
              : {},

          select: {
            id: true,
            name: true,
            logoUrl: true,
          },

          orderBy: {
            name:
              'asc',
          },
        }),
      ]);

    const targetIds =
      [
        ...new Set(
          events.map(
            (
              event,
            ) =>
              event.userId,
          ),
        ),
      ];

    const summaries =
      new Map<
        string,
        Awaited<
          ReturnType<
            FairPlayService[
              'summaryForUser'
            ]
          >
        >
      >();

    for (
      const targetId
      of targetIds
    ) {
      summaries.set(
        targetId,
        await this.summaryForUser(
          targetId,
        ),
      );
    }

    return {
      success: true,

      data: {
        policy:
          this.publicPolicy(),

        leagues,

        pendingAppeals:
          appeals.map(
            (
              appeal,
            ) => ({
              ...appeal,
              player:
                this.identity(
                  appeal.appealedBy,
                ),
            }),
          ),

        events:
          events.map(
            (
              event,
            ) => ({
              id:
                event.id,
              kind:
                event.kind,
              pointsDelta:
                event.pointsDelta,
              title:
                event.title,
              reason:
                event.reason,
              evidenceUrl:
                event.evidenceUrl,
              issuedAt:
                event.issuedAt,
              expiresAt:
                event.expiresAt,
              revokedAt:
                event.revokedAt,
              revocationNote:
                event.revocationNote,
              active:
                this.isEventActive(
                  event,
                ),
              league:
                event.league,
              player:
                this.identity(
                  event.user,
                ),
              issuer:
                this.identity(
                  event.issuedBy,
                ),
              latestAppeal:
                event.appeals[0] ??
                null,
              summary:
                summaries.get(
                  event.userId,
                ) ??
                null,
            }),
          ),
      },

      error: null,
    };
  }

  async revokeEvent(
    adminUserId: string,
    eventId: string,
    dto:
      RevokeFairPlayEventDto,
  ) {
    const event =
      await this.requireEvent(
        eventId,
      );

    await this.authorization.assertLeagueAdmin(
      adminUserId,
      event.leagueId,
    );

    if (
      event.revokedAt
    ) {
      return {
        success: true,

        data: {
          message:
            'Fair Play event is already revoked.',
          event,
        },

        error: null,
      };
    }

    const now =
      new Date();

    const updated =
      await this.prisma.fairPlayEvent.update({
        where: {
          id:
            event.id,
        },

        data: {
          revokedAt:
            now,
          revokedByUserId:
            adminUserId,
          revocationNote:
            dto.reason.trim(),
        },
      });

    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          adminUserId,
        action:
          'FAIR_PLAY_EVENT_REVOKED',
        targetType:
          'FairPlayEvent',
        targetId:
          event.id,
        scopeType:
          'LEAGUE',
        scopeId:
          event.leagueId,
        beforeData: {
          revokedAt:
            null,
        },
        afterData: {
          revokedAt:
            now,
        },
        metadata: {
          targetUserId:
            event.userId,
        },
      },
    });

    await this.notify(
      event.userId,
      {
        title:
          'Fair Play Record Updated',
        message:
          'A Fair Play event was revoked after admin review. Your score has been recalculated.',
        href:
          '/fair-play',
        entityId:
          event.id,
        dedupeKey:
          `fair-play-revoked:${event.id}`,
      },
    );

    return {
      success: true,

      data: {
        message:
          'Fair Play event revoked.',
        event:
          updated,
      },

      error: null,
    };
  }

  async resolveAppeal(
    adminUserId: string,
    appealId: string,
    dto:
      ResolveFairPlayAppealDto,
  ) {
    const appeal =
      await this.prisma.fairPlayAppeal.findUnique({
        where: {
          id:
            appealId,
        },

        include: {
          event:
            true,
        },
      });

    if (
      !appeal
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_APPEAL_NOT_FOUND',

          message:
            'Fair Play appeal could not be found.',
        },
      });
    }

    await this.authorization.assertLeagueAdmin(
      adminUserId,
      appeal.event
        .leagueId,
    );

    if (
      appeal.status !==
        'PENDING'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_APPEAL_ALREADY_RESOLVED',

          message:
            'This Fair Play appeal has already been resolved.',
        },
      });
    }

    const now =
      new Date();

    const result =
      await this.prisma.$transaction(
        async (
          tx,
        ) => {
          const resolved =
            await tx.fairPlayAppeal.update({
              where: {
                id:
                  appeal.id,
              },

              data: {
                status:
                  dto.status,
                resolutionNote:
                  dto.resolutionNote
                    .trim(),
                resolvedByUserId:
                  adminUserId,
                resolvedAt:
                  now,
              },
            });

          if (
            dto.status ===
              'OVERTURNED' &&
            !appeal.event
              .revokedAt
          ) {
            await tx.fairPlayEvent.update({
              where: {
                id:
                  appeal.eventId,
              },

              data: {
                revokedAt:
                  now,
                revokedByUserId:
                  adminUserId,
                revocationNote:
                  'Overturned through Fair Play appeal: ' +
                  dto.resolutionNote
                    .trim(),
              },
            });
          }

          return resolved;
        },
        {
          isolationLevel:
            'Serializable',
        },
      );

    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          adminUserId,
        action:
          dto.status ===
          'OVERTURNED'
            ? 'FAIR_PLAY_APPEAL_OVERTURNED'
            : 'FAIR_PLAY_APPEAL_UPHELD',
        targetType:
          'FairPlayAppeal',
        targetId:
          appeal.id,
        scopeType:
          'LEAGUE',
        scopeId:
          appeal.event
            .leagueId,
        metadata: {
          eventId:
            appeal.eventId,
          targetUserId:
            appeal.appealedByUserId,
        },
      },
    });

    await this.notify(
      appeal.appealedByUserId,
      {
        title:
          dto.status ===
          'OVERTURNED'
            ? 'Fair Play Appeal Accepted'
            : 'Fair Play Appeal Reviewed',
        message:
          dto.status ===
          'OVERTURNED'
            ? 'Your Fair Play appeal was accepted. The event was revoked and your score was recalculated.'
            : 'Your Fair Play appeal was reviewed and the original event remains active.',
        href:
          '/fair-play',
        entityId:
          appeal.id,
        dedupeKey:
          `fair-play-appeal-resolved:${appeal.id}`,
      },
    );

    return {
      success: true,

      data: {
        message:
          dto.status ===
          'OVERTURNED'
            ? 'Appeal overturned and Fair Play event revoked.'
            : 'Appeal upheld.',
        appeal:
          result,
      },

      error: null,
    };
  }

  private async summaryForUser(
    userId: string,
  ) {
    const now =
      new Date();

    const events =
      await this.prisma.fairPlayEvent.findMany({
        where: {
          userId,
        },

        select: {
          id: true,
          kind: true,
          pointsDelta:
            true,
          issuedAt: true,
          expiresAt: true,
          revokedAt: true,
        },

        orderBy: {
          issuedAt:
            'desc',
        },

        take: 500,
      });

    const active =
      events.filter(
        (
          event,
        ) =>
          !event.revokedAt &&
          (
            !event.expiresAt ||
            event.expiresAt >
              now
          ),
      );

    const points =
      active.reduce(
        (
          total,
          event,
        ) =>
          total +
          event.pointsDelta,
        0,
      );

    const score =
      Math.max(
        0,
        Math.min(
          100,
          100 +
            points,
        ),
      );

    return {
      score,
      status:
        this.statusForScore(
          score,
        ),
      baseScore:
        100,
      activePointsDelta:
        points,
      activeEvents:
        active.length,
      activePenaltyEvents:
        active.filter(
          (
            event,
          ) =>
            event.pointsDelta <
            0,
        ).length,
      activeWarnings:
        active.filter(
          (
            event,
          ) =>
            event.kind ===
            'WARNING',
        ).length,
      commendations:
        active.filter(
          (
            event,
          ) =>
            event.kind ===
            'COMMENDATION',
        ).length,
      lastUpdatedAt:
        events[0]
          ?.issuedAt ??
        null,
      automaticPenalty:
        false,
    };
  }

  private statusForScore(
    score: number,
  ) {
    if (
      score >=
      95
    ) {
      return 'EXEMPLARY';
    }

    if (
      score >=
      85
    ) {
      return 'GOOD_STANDING';
    }

    if (
      score >=
      70
    ) {
      return 'CAUTION';
    }

    return 'NEEDS_REVIEW';
  }

  private publicPolicy() {
    return Object.entries(
      FAIR_PLAY_POLICY,
    ).map(
      (
        [
          kind,
          policy,
        ],
      ) => ({
        kind,
        points:
          policy.points,
        activeDays:
          policy.days,
        title:
          policy.title,
      }),
    );
  }

  private isEventActive(
    event: {
      revokedAt:
        Date | null;
      expiresAt:
        Date | null;
    },
  ) {
    return (
      !event.revokedAt &&
      (
        !event.expiresAt ||
        event.expiresAt >
          new Date()
      )
    );
  }

  private async adminLeagueScope(
    userId: string,
  ) {
    const superAdmin =
      await this.authorization.isSuperAdmin(
        userId,
      );

    if (
      superAdmin
    ) {
      return {
        superAdmin:
          true,
        leagueIds:
          [] as string[],
      };
    }

    const roles =
      await this.prisma.leagueAdmin.findMany({
        where: {
          userId,
        },

        select: {
          leagueId:
            true,
        },
      });

    const leagueIds =
      roles.map(
        (
          role,
        ) =>
          role.leagueId,
      );

    if (
      leagueIds.length ===
      0
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_ADMIN_REQUIRED',

          message:
            'League Admin access is required.',
        },
      });
    }

    return {
      superAdmin:
        false,
      leagueIds,
    };
  }

  private async requireEvent(
    eventId: string,
  ) {
    const event =
      await this.prisma.fairPlayEvent.findUnique({
        where: {
          id:
            eventId,
        },
      });

    if (
      !event
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'FAIR_PLAY_EVENT_NOT_FOUND',

          message:
            'Fair Play event could not be found.',
        },
      });
    }

    return event;
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
          status:
            true,
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

  private identity(
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
        null,
      profileImageUrl:
        user.player
          ?.profileImageUrl ??
        null,
    };
  }

  private async notify(
    userId: string,
    input: {
      title: string;
      message: string;
      href: string;
      entityId: string;
      dedupeKey: string;
    },
  ) {
    await this.prisma.notification.upsert({
      where: {
        dedupeKey:
          input.dedupeKey,
      },

      create: {
        userId,
        type:
          'FAIR_PLAY_UPDATED',
        title:
          input.title,
        message:
          input.message,
        href:
          input.href,
        entityType:
          'FairPlay',
        entityId:
          input.entityId,
        dedupeKey:
          input.dedupeKey,
        eventAt:
          new Date(),
      },

      update: {
        title:
          input.title,
        message:
          input.message,
        href:
          input.href,
        eventAt:
          new Date(),
      },
    });
  }
}
