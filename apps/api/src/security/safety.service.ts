import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  AuditService,
} from './audit.service.js';

import type {
  BlockUserDto,
} from './dto/block-user.dto.js';

import type {
  ReportUserContentDto,
} from './dto/report-user-content.dto.js';

import type {
  ResolveSafetyReportDto,
} from './dto/resolve-safety-report.dto.js';

const BLOCK_ACTIONS = [
  'USER_BLOCKED',
  'USER_UNBLOCKED',
] as const;

@Injectable()
export class SafetyService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly audit:
      AuditService,
  ) {}

  async reportUserContent(
    reporterUserId: string,
    dto: ReportUserContentDto,
  ) {
    const target =
      await this.resolveTargetByInGameName(
        dto.targetInGameName,
      );

    if (
      target.userId ===
      reporterUserId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'SAFETY_SELF_REPORT_NOT_ALLOWED',
          message:
            'You cannot report your own account.',
        },
      });
    }

    const since =
      new Date(
        Date.now() -
          60 * 60 * 1000,
      );

    const recentReports =
      await this.prisma.auditLog.count({
        where: {
          actorUserId:
            reporterUserId,
          action:
            'UGC_REPORT_SUBMITTED',
          createdAt: {
            gte: since,
          },
        },
      });

    if (
      recentReports >= 10
    ) {
      throw new HttpException(
        {
          success: false,
          data: null,
          error: {
            code:
              'SAFETY_REPORT_RATE_LIMITED',
            message:
              'Too many reports were submitted recently. Please try again later.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const report =
      await this.audit.record({
        actorUserId:
          reporterUserId,

        action:
          'UGC_REPORT_SUBMITTED',

        targetType:
          'USER',

        targetId:
          target.userId,

        scopeType:
          'SAFETY',

        scopeId:
          reporterUserId,

        metadata: {
          status:
            'OPEN',

          target: {
            userId:
              target.userId,

            inGameName:
              target.inGameName,

            playerCode:
              target.playerCode,
          },

          reason:
            dto.reason,

          contentType:
            dto.contentType,

          details:
            dto.details?.trim() ||
            null,

          contentReference:
            dto.contentReference?.trim() ||
            null,

          submittedAt:
            new Date().toISOString(),
        },
      });

    return {
      success: true,

      data: {
        message:
          'Report submitted. FC ARENA moderation can review it.',

        report: {
          id:
            report.id,

          status:
            'OPEN',

          createdAt:
            report.createdAt,
        },
      },

      error: null,
    };
  }

  async getMyReports(
    userId: string,
  ) {
    const reports =
      await this.prisma.auditLog.findMany({
        where: {
          actorUserId:
            userId,

          action:
            'UGC_REPORT_SUBMITTED',
        },

        orderBy: {
          createdAt:
            'desc',
        },

        take: 100,
      });

    const resolutionByReport =
      await this.getResolutionMap(
        reports.map(
          (
            report,
          ) =>
            report.id,
        ),
      );

    const targetUsers =
      await this.getUsersByIds(
        reports.map(
          (
            report,
          ) =>
            report.targetId,
        ),
      );

    const uniqueTargetIds =
      [
        ...new Set(
          reports.map(
            (
              report,
            ) =>
              report.targetId,
          ),
        ),
      ];

    const reportCounts =
      uniqueTargetIds.length ===
      0
        ? []
        : await this.prisma.auditLog.groupBy({
            by: [
              'targetId',
            ],
            where: {
              action:
                'UGC_REPORT_SUBMITTED',
              targetType:
                'USER',
              targetId: {
                in:
                  uniqueTargetIds,
              },
            },
            _count: {
              _all:
                true,
            },
          });

    const reportCountByTarget =
      new Map(
        reportCounts.map(
          (
            row,
          ) => [
            row.targetId,
            row._count._all,
          ],
        ),
      );

    return {
      success: true,

      data: {
        reports:
          reports.map(
            (
              report,
            ) =>
              this.mapReport(
                report,
                targetUsers.get(
                  report.targetId,
                ) ??
                  null,
                resolutionByReport.get(
                  report.id,
                ) ??
                  null,
              ),
          ),
      },

      error: null,
    };
  }

  async blockUser(
    userId: string,
    dto: BlockUserDto,
  ) {
    const target =
      await this.resolveTargetByInGameName(
        dto.targetInGameName,
      );

    if (
      target.userId ===
      userId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'SAFETY_SELF_BLOCK_NOT_ALLOWED',
          message:
            'You cannot block your own account.',
        },
      });
    }

    const latestAction =
      await this.getLatestBlockAction(
        userId,
        target.userId,
      );

    if (
      latestAction?.action ===
      'USER_BLOCKED'
    ) {
      return {
        success: true,

        data: {
          message:
            'This player is already blocked.',

          blockedUser: {
            ...target,

            blockedAt:
              latestAction.createdAt,
          },
        },

        error: null,
      };
    }

    const block =
      await this.audit.record({
        actorUserId:
          userId,

        action:
          'USER_BLOCKED',

        targetType:
          'USER',

        targetId:
          target.userId,

        scopeType:
          'SAFETY',

        scopeId:
          userId,

        metadata: {
          target: {
            userId:
              target.userId,

            inGameName:
              target.inGameName,

            playerCode:
              target.playerCode,
          },

          effect:
            'Blocks new League-owner membership interactions in either direction. Official competition records remain unchanged.',

          blockedAt:
            new Date().toISOString(),
        },
      });

    return {
      success: true,

      data: {
        message:
          'Player blocked. New League-owner membership interactions between you are now restricted.',

        blockedUser: {
          ...target,

          blockedAt:
            block.createdAt,
        },
      },

      error: null,
    };
  }

  async unblockUser(
    userId: string,
    targetUserId: string,
  ) {
    const latestAction =
      await this.getLatestBlockAction(
        userId,
        targetUserId,
      );

    if (
      !latestAction ||
      latestAction.action !==
        'USER_BLOCKED'
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'SAFETY_USER_NOT_BLOCKED',
          message:
            'This player is not currently blocked.',
        },
      });
    }

    await this.audit.record({
      actorUserId:
        userId,

      action:
        'USER_UNBLOCKED',

      targetType:
        'USER',

      targetId:
        targetUserId,

      scopeType:
        'SAFETY',

      scopeId:
        userId,

      metadata: {
        unblockedAt:
          new Date().toISOString(),
      },
    });

    return {
      success: true,

      data: {
        message:
          'Player unblocked.',
      },

      error: null,
    };
  }

  async getBlockedUsers(
    userId: string,
  ) {
    const logs =
      await this.prisma.auditLog.findMany({
        where: {
          actorUserId:
            userId,

          targetType:
            'USER',

          action: {
            in: [
              ...BLOCK_ACTIONS,
            ],
          },
        },

        select: {
          targetId: true,
          action: true,
          createdAt: true,
        },

        orderBy: {
          createdAt:
            'desc',
        },

        take: 1000,
      });

    const latestByTarget =
      new Map<
        string,
        {
          action: string;
          createdAt: Date;
        }
      >();

    for (
      const log
      of logs
    ) {
      if (
        !latestByTarget.has(
          log.targetId,
        )
      ) {
        latestByTarget.set(
          log.targetId,
          {
            action:
              log.action,

            createdAt:
              log.createdAt,
          },
        );
      }
    }

    const activeBlocks =
      [...latestByTarget.entries()]
        .filter(
          (
            [
              ,
              value,
            ],
          ) =>
            value.action ===
            'USER_BLOCKED',
        );

    const users =
      await this.getUsersByIds(
        activeBlocks.map(
          (
            [
              userIdValue,
            ],
          ) =>
            userIdValue,
        ),
      );

    return {
      success: true,

      data: {
        blockedUsers:
          activeBlocks
            .map(
              (
                [
                  blockedUserId,
                  block,
                ],
              ) => {
                const user =
                  users.get(
                    blockedUserId,
                  );

                if (!user) {
                  return null;
                }

                return {
                  ...user,

                  blockedAt:
                    block.createdAt,
                };
              },
            )
            .filter(
              (
                user,
              ): user is NonNullable<
                typeof user
              > =>
                user !==
                null,
            ),
      },

      error: null,
    };
  }

  async isInteractionBlocked(
    firstUserId: string,
    secondUserId: string,
  ): Promise<boolean> {
    if (
      firstUserId ===
      secondUserId
    ) {
      return false;
    }

    const [
      firstToSecond,
      secondToFirst,
    ] =
      await Promise.all([
        this.getLatestBlockAction(
          firstUserId,
          secondUserId,
        ),

        this.getLatestBlockAction(
          secondUserId,
          firstUserId,
        ),
      ]);

    return (
      firstToSecond?.action ===
        'USER_BLOCKED' ||
      secondToFirst?.action ===
        'USER_BLOCKED'
    );
  }

  async getAdminReports(
    adminUserId: string,
  ) {
    await this.assertSuperAdmin(
      adminUserId,
    );

    const reports =
      await this.prisma.auditLog.findMany({
        where: {
          action:
            'UGC_REPORT_SUBMITTED',
        },

        include: {
          actor: {
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

        orderBy: {
          createdAt:
            'desc',
        },

        take: 250,
      });

    const resolutionByReport =
      await this.getResolutionMap(
        reports.map(
          (
            report,
          ) =>
            report.id,
        ),
      );

    const targetUsers =
      await this.getUsersByIds(
        reports.map(
          (
            report,
          ) =>
            report.targetId,
        ),
      );

    return {
      success: true,

      data: {
        reports:
          reports.map(
            (
              report,
            ) => ({
              ...this.mapReport(
                report,
                targetUsers.get(
                  report.targetId,
                ) ??
                  null,
                resolutionByReport.get(
                  report.id,
                ) ??
                  null,
              ),

              reporter: {
                userId:
                  report.actor?.id ??
                  null,

                fullName:
                  report.actor
                    ?.fullName ??
                  'Deleted user',

                inGameName:
                  report.actor
                    ?.player
                    ?.identity
                    ?.inGameName ??
                  null,

                playerCode:
                  report.actor
                    ?.player
                    ?.playerCode ??
                  null,
              },

              reportsAgainstTarget:
                reportCountByTarget.get(
                  report.targetId,
                ) ??
                0,
            }),
          ),
      },

      error: null,
    };
  }

  async resolveReport(
    adminUserId: string,
    reportId: string,
    dto: ResolveSafetyReportDto,
  ) {
    await this.assertSuperAdmin(
      adminUserId,
    );

    const report =
      await this.prisma.auditLog.findUnique({
        where: {
          id: reportId,
        },
      });

    if (
      !report ||
      report.action !==
        'UGC_REPORT_SUBMITTED'
    ) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'SAFETY_REPORT_NOT_FOUND',
          message:
            'Safety report could not be found.',
        },
      });
    }

    const existingResolution =
      await this.prisma.auditLog.findFirst({
        where: {
          action:
            'UGC_REPORT_RESOLVED',

          targetType:
            'SAFETY_REPORT',

          targetId:
            report.id,
        },

        orderBy: {
          createdAt:
            'desc',
        },
      });

    if (
      existingResolution
    ) {
      return {
        success: true,

        data: {
          message:
            'This safety report is already resolved.',

          reportId:
            report.id,

          resolvedAt:
            existingResolution.createdAt,
        },

        error: null,
      };
    }

    const decision =
      dto.decision ??
      'RESOLVED';

    const resolution =
      await this.audit.record({
        actorUserId:
          adminUserId,

        action:
          'UGC_REPORT_RESOLVED',

        targetType:
          'SAFETY_REPORT',

        targetId:
          report.id,

        scopeType:
          'SAFETY',

        scopeId:
          report.targetId,

        metadata: {
          status:
            decision,

          note:
            dto.note?.trim() ||
            null,

          resolvedAt:
            new Date().toISOString(),
        },
      });

    return {
      success: true,

      data: {
        message:
          'Safety report marked as resolved.',

        reportId:
          report.id,

        resolvedAt:
          resolution.createdAt,
      },

      error: null,
    };
  }

  private async resolveTargetByInGameName(
    rawInGameName: string,
  ) {
    const inGameNameNormalized =
      rawInGameName
        .trim()
        .toLowerCase();

    const identity =
      await this.prisma.playerIdentity.findUnique({
        where: {
          inGameNameNormalized,
        },

        select: {
          inGameName: true,

          player: {
            select: {
              playerCode: true,
              profileImageUrl: true,

              user: {
                select: {
                  id: true,
                  fullName: true,
                  status: true,
                },
              },
            },
          },
        },
      });

    if (!identity) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'SAFETY_TARGET_NOT_FOUND',
          message:
            'No FC ARENA player was found with that In-Game Name.',
        },
      });
    }

    return {
      userId:
        identity.player.user.id,

      fullName:
        identity.player.user.fullName,

      inGameName:
        identity.inGameName,

      playerCode:
        identity.player.playerCode,

      profileImageUrl:
        identity.player.profileImageUrl,
    };
  }

  private async getLatestBlockAction(
    actorUserId: string,
    targetUserId: string,
  ) {
    return this.prisma.auditLog.findFirst({
      where: {
        actorUserId,

        targetType:
          'USER',

        targetId:
          targetUserId,

        action: {
          in: [
            ...BLOCK_ACTIONS,
          ],
        },
      },

      select: {
        action: true,
        createdAt: true,
      },

      orderBy: {
        createdAt:
          'desc',
      },
    });
  }

  private async getUsersByIds(
    rawUserIds: string[],
  ) {
    const userIds =
      [...new Set(
        rawUserIds.filter(
          Boolean,
        ),
      )];

    if (
      userIds.length ===
      0
    ) {
      return new Map<
        string,
        {
          userId: string;
          fullName: string;
          inGameName:
            string | null;
          playerCode:
            string | null;
          profileImageUrl:
            string | null;
        }
      >();
    }

    const users =
      await this.prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },

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
      });

    return new Map(
      users.map(
        (
          user,
        ) => [
          user.id,
          {
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
          },
        ],
      ),
    );
  }

  private async getResolutionMap(
    reportIds: string[],
  ) {
    if (
      reportIds.length ===
      0
    ) {
      return new Map<
        string,
        any
      >();
    }

    const resolutions =
      await this.prisma.auditLog.findMany({
        where: {
          action:
            'UGC_REPORT_RESOLVED',

          targetType:
            'SAFETY_REPORT',

          targetId: {
            in: reportIds,
          },
        },

        orderBy: {
          createdAt:
            'desc',
        },
      });

    const map =
      new Map<
        string,
        any
      >();

    for (
      const resolution
      of resolutions
    ) {
      if (
        !map.has(
          resolution.targetId,
        )
      ) {
        map.set(
          resolution.targetId,
          resolution,
        );
      }
    }

    return map;
  }

  private mapReport(
    report: any,
    targetUser: any,
    resolution: any,
  ) {
    const metadata =
      report.metadata &&
      typeof report.metadata ===
        'object' &&
      !Array.isArray(
        report.metadata,
      )
        ? report.metadata as
            Record<
              string,
              any
            >
        : {};

    const resolutionMetadata =
      resolution?.metadata &&
      typeof resolution.metadata ===
        'object' &&
      !Array.isArray(
        resolution.metadata,
      )
        ? resolution.metadata as
            Record<
              string,
              any
            >
        : {};

    return {
      id:
        report.id,

      target:
        targetUser ?? {
          userId:
            report.targetId,

          fullName:
            'Unavailable player',

          inGameName:
            metadata.target
              ?.inGameName ??
            null,

          playerCode:
            metadata.target
              ?.playerCode ??
            null,

          profileImageUrl:
            null,
        },

      reason:
        metadata.reason ??
        'OTHER',

      contentType:
        metadata.contentType ??
        'USER_PROFILE',

      details:
        metadata.details ??
        null,

      contentReference:
        metadata.contentReference ??
        null,

      status:
        resolution
          ? (
              resolutionMetadata.status ===
              'DISMISSED'
                ? 'DISMISSED'
                : 'RESOLVED'
            )
          : 'OPEN',

      createdAt:
        report.createdAt,

      resolution:
        resolution
          ? {
              decision:
                resolutionMetadata.status ===
                'DISMISSED'
                  ? 'DISMISSED'
                  : 'RESOLVED',

              note:
                resolutionMetadata.note ??
                null,

              resolvedAt:
                resolution.createdAt,
            }
          : null,
    };
  }

  private async assertSuperAdmin(
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

    if (
      !user ||
      user.role !==
        'SUPER_ADMIN'
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'SUPER_ADMIN_REQUIRED',
          message:
            'Super Admin access is required for the safety moderation queue.',
        },
      });
    }
  }
}
