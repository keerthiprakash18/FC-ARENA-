import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  timingSafeEqual,
} from 'node:crypto';

import {
  PrismaService,
} from '../database/prisma.service.js';

import type {
  BackupReportDto,
} from './dto/backup-report.dto.js';

import type {
  CreateAndroidReleaseDto,
} from './dto/create-android-release.dto.js';

import type {
  UpdateAndroidReleaseDto,
} from './dto/update-android-release.dto.js';

interface AdminScope {
  superAdmin: boolean;
  leagueIds: string[];
}

@Injectable()
export class AdminOpsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async overview(
    userId: string,
  ) {
    const scope =
      await this.adminScope(
        userId,
      );

    const leagueWhere =
      scope.superAdmin
        ? {}
        : {
            id: {
              in:
                scope.leagueIds,
            },
          };

    const tournamentWhere =
      scope.superAdmin
        ? {}
        : {
            leagueId: {
              in:
                scope.leagueIds,
            },
          };

    const matchScope =
      scope.superAdmin
        ? {}
        : {
            tournament: {
              leagueId: {
                in:
                  scope.leagueIds,
              },
            },
          };

    const memberRows =
      scope.superAdmin
        ? []
        : await this.prisma.leagueMember.findMany({
            where: {
              leagueId: {
                in:
                  scope.leagueIds,
              },
            },

            select: {
              userId: true,
            },

            distinct: [
              'userId',
            ],
          });

    const scopedUserIds =
      memberRows.map(
        (
          row,
        ) =>
          row.userId,
      );

    const [
      players,
      leagues,
      tournaments,
      activeTournaments,
      completedTournaments,
      scheduledMatches,
      liveMatches,
      completedMatches,
      pendingResults,
      openDisputes,
      pendingApplications,
      activeWars,
      pushDevices,
      tournamentIds,
    ] =
      await Promise.all([
        scope.superAdmin
          ? this.prisma.user.count({
              where: {
                status:
                  'ACTIVE',
              },
            })
          : scopedUserIds.length >
              0
            ? this.prisma.user.count({
                where: {
                  id: {
                    in:
                      scopedUserIds,
                  },

                  status:
                    'ACTIVE',
                },
              })
            : 0,

        this.prisma.league.count({
          where:
            leagueWhere,
        }),

        this.prisma.tournament.count({
          where:
            tournamentWhere,
        }),

        this.prisma.tournament.count({
          where: {
            ...tournamentWhere,

            status: {
              in: [
                'REGISTRATION_OPEN',
                'REGISTRATION_CLOSED',
                'ACTIVE',
              ],
            },
          },
        }),

        this.prisma.tournament.count({
          where: {
            ...tournamentWhere,
            status:
              'COMPLETED',
          },
        }),

        this.prisma.match.count({
          where: {
            ...matchScope,

            status:
              'SCHEDULED',
          },
        }),

        this.prisma.match.count({
          where: {
            ...matchScope,

            status:
              'LIVE',
          },
        }),

        this.prisma.match.count({
          where: {
            ...matchScope,

            status:
              'COMPLETED',
          },
        }),

        this.prisma.resultSubmission.count({
          where: {
            status:
              'PENDING_VERIFICATION',

            ...(scope.superAdmin
              ? {}
              : {
                  match: {
                    tournament: {
                      leagueId: {
                        in:
                          scope.leagueIds,
                      },
                    },
                  },
                }),
          },
        }),

        this.prisma.matchDispute.count({
          where: {
            status:
              'OPEN',

            ...(scope.superAdmin
              ? {}
              : {
                  match: {
                    tournament: {
                      leagueId: {
                        in:
                          scope.leagueIds,
                      },
                    },
                  },
                }),
          },
        }),

        this.prisma.leagueApplication.count({
          where: {
            status:
              'PENDING',

            ...(scope.superAdmin
              ? {}
              : {
                  leagueId: {
                    in:
                      scope.leagueIds,
                  },
                }),
          },
        }),

        this.prisma.leagueWar.count({
          where: {
            status: {
              in: [
                'INVITED',
                'ACCEPTED',
                'LIVE',
              ],
            },

            ...(scope.superAdmin
              ? {}
              : {
                  OR: [
                    {
                      homeLeagueId: {
                        in:
                          scope.leagueIds,
                      },
                    },
                    {
                      awayLeagueId: {
                        in:
                          scope.leagueIds,
                      },
                    },
                  ],
                }),
          },
        }),

        scope.superAdmin
          ? this.prisma.pushDevice.count()
          : scopedUserIds.length >
              0
            ? this.prisma.pushDevice.count({
                where: {
                  userId: {
                    in:
                      scopedUserIds,
                  },
                },
              })
            : 0,

        this.prisma.tournament.findMany({
          where:
            tournamentWhere,

          select: {
            id: true,
          },
        }),
      ]);

    const scopedTournamentIds =
      tournamentIds.map(
        (
          tournament,
        ) =>
          tournament.id,
      );

    const now =
      new Date();

    const fourteenDaysAgo =
      new Date(
        now.getTime() -
          13 *
            24 *
            60 *
            60 *
            1000,
      );

    fourteenDaysAgo.setHours(
      0,
      0,
      0,
      0,
    );

    const staleMatchCutoff =
      new Date(
        now.getTime() -
          2 *
            60 *
            60 *
            1000,
      );

    const oldResultCutoff =
      new Date(
        now.getTime() -
          30 *
            60 *
            1000,
      );

    const oldDisputeCutoff =
      new Date(
        now.getTime() -
          24 *
            60 *
            60 *
            1000,
      );

    const [
      confirmedRows,
      accountRows,
      membershipRows,
      topLeagues,
      recentAudit,
      staleScheduledMatches,
      oldPendingResults,
      oldOpenDisputes,
    ] =
      await Promise.all([
        this.prisma.resultSubmission.findMany({
          where: {
            status:
              'CONFIRMED',

            OR: [
              {
                reviewedAt: {
                  gte:
                    fourteenDaysAgo,
                },
              },
              {
                reviewedAt:
                  null,

                updatedAt: {
                  gte:
                    fourteenDaysAgo,
                },
              },
            ],

            ...(scope.superAdmin
              ? {}
              : {
                  match: {
                    tournament: {
                      leagueId: {
                        in:
                          scope.leagueIds,
                      },
                    },
                  },
                }),
          },

          select: {
            reviewedAt: true,
            updatedAt: true,
          },
        }),

        scope.superAdmin
          ? this.prisma.user.findMany({
              where: {
                createdAt: {
                  gte:
                    fourteenDaysAgo,
                },
              },

              select: {
                id: true,
                createdAt: true,
              },
            })
          : [],

        scope.superAdmin
          ? []
          : this.prisma.leagueMember.findMany({
              where: {
                leagueId: {
                  in:
                    scope.leagueIds,
                },

                joinedAt: {
                  gte:
                    fourteenDaysAgo,
                },
              },

              select: {
                userId: true,
                joinedAt: true,
              },
            }),

        this.prisma.league.findMany({
          where:
            leagueWhere,

          select: {
            id: true,
            name: true,
            logoUrl: true,
            region: true,

            _count: {
              select: {
                members: true,
                tournaments: true,
              },
            },
          },

          orderBy: {
            members: {
              _count:
                'desc',
            },
          },

          take: 6,
        }),

        this.prisma.auditLog.findMany({
          where:
            scope.superAdmin
              ? {}
              : {
                  OR: [
                    {
                      scopeType:
                        'LEAGUE',

                      scopeId: {
                        in:
                          scope.leagueIds,
                      },
                    },

                    ...(scopedTournamentIds.length >
                    0
                      ? [
                          {
                            scopeType:
                              'TOURNAMENT',

                            scopeId: {
                              in:
                                scopedTournamentIds,
                            },
                          },
                        ]
                      : []),
                  ],
                },

          include: {
            actor: {
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
          },

          orderBy: {
            createdAt:
              'desc',
          },

          take: 16,
        }),

        this.prisma.match.count({
          where: {
            ...matchScope,

            status:
              'SCHEDULED',

            fixture: {
              scheduledAt: {
                lt:
                  staleMatchCutoff,
              },
            },
          },
        }),

        this.prisma.resultSubmission.count({
          where: {
            status:
              'PENDING_VERIFICATION',

            createdAt: {
              lt:
                oldResultCutoff,
            },

            ...(scope.superAdmin
              ? {}
              : {
                  match: {
                    tournament: {
                      leagueId: {
                        in:
                          scope.leagueIds,
                      },
                    },
                  },
                }),
          },
        }),

        this.prisma.matchDispute.count({
          where: {
            status:
              'OPEN',

            createdAt: {
              lt:
                oldDisputeCutoff,
            },

            ...(scope.superAdmin
              ? {}
              : {
                  match: {
                    tournament: {
                      leagueId: {
                        in:
                          scope.leagueIds,
                      },
                    },
                  },
                }),
          },
        }),
      ]);

    const series =
      this.emptySeries(
        fourteenDaysAgo,
        14,
      );

    const seriesMap =
      new Map(
        series.map(
          (
            item,
          ) => [
            item.day,
            item,
          ],
        ),
      );

    for (
      const row
      of confirmedRows
    ) {
      const eventAt =
        row.reviewedAt ??
        row.updatedAt;

      const key =
        this.dayKey(
          eventAt,
        );

      const item =
        seriesMap.get(
          key,
        );

      if (
        item
      ) {
        item.confirmedResults +=
          1;
      }
    }

    if (
      scope.superAdmin
    ) {
      for (
        const row
        of accountRows
      ) {
        const item =
          seriesMap.get(
            this.dayKey(
              row.createdAt,
            ),
          );

        if (
          item
        ) {
          item.newPlayers +=
            1;
        }
      }
    } else {
      const seen =
        new Set<string>();

      for (
        const row
        of membershipRows
      ) {
        const key =
          this.dayKey(
            row.joinedAt,
          );

        const identity =
          `${key}:${row.userId}`;

        if (
          seen.has(
            identity,
          )
        ) {
          continue;
        }

        seen.add(
          identity,
        );

        const item =
          seriesMap.get(
            key,
          );

        if (
          item
        ) {
          item.newPlayers +=
            1;
        }
      }
    }

    return {
      success: true,

      data: {
        scope: {
          global:
            scope.superAdmin,
          leagueIds:
            scope.leagueIds,
        },

        totals: {
          players,
          leagues,
          tournaments,
          activeTournaments,
          completedTournaments,
          scheduledMatches,
          liveMatches,
          completedMatches,
          pendingResults,
          openDisputes,
          pendingApplications,
          activeWars,
          pushDevices,
        },

        trend: {
          label:
            scope.superAdmin
              ? 'New accounts'
              : 'New managed-League members',
          days:
            series,
        },

        alerts: {
          staleScheduledMatches,
          oldPendingResults,
          oldOpenDisputes,

          total:
            staleScheduledMatches +
            oldPendingResults +
            oldOpenDisputes,
        },

        topLeagues:
          topLeagues.map(
            (
              league,
            ) => ({
              id:
                league.id,
              name:
                league.name,
              logoUrl:
                league.logoUrl,
              region:
                league.region,
              members:
                league
                  ._count
                  .members,
              tournaments:
                league
                  ._count
                  .tournaments,
            }),
          ),

        recentAudit:
          recentAudit.map(
            (
              event,
            ) => ({
              id:
                event.id,
              action:
                event.action,
              targetType:
                event.targetType,
              targetId:
                event.targetId,
              scopeType:
                event.scopeType,
              scopeId:
                event.scopeId,
              createdAt:
                event.createdAt,

              actor:
                event.actor
                  ? {
                      id:
                        event.actor.id,
                      name:
                        event.actor
                          .player
                          ?.identity
                          ?.inGameName ??
                        event.actor
                          .fullName,
                      playerCode:
                        event.actor
                          .player
                          ?.playerCode ??
                        null,
                    }
                  : null,
            }),
          ),
      },

      error: null,
    };
  }

  async system(
    userId: string,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    const started =
      performance.now();

    await this.prisma.$queryRaw`SELECT 1`;

    const databaseLatencyMs =
      Number(
        (
          performance.now() -
          started
        ).toFixed(
          1,
        ),
      );

    const now =
      new Date();

    const activeSessionCutoff =
      new Date();

    const [
      activeSessions,
      pushDevices,
      pendingPushDeliveries,
      failedPushDeliveries,
      latestBackup,
      latestSuccessfulBackup,
      lastFailedBackup,
      openDisputes,
      pendingResults,
    ] =
      await Promise.all([
        this.prisma.refreshSession.count({
          where: {
            revokedAt:
              null,
            expiresAt: {
              gt:
                activeSessionCutoff,
            },
          },
        }),

        this.prisma.pushDevice.count(),

        this.prisma.pushDelivery.count({
          where: {
            deliveredAt:
              null,
            attempts: {
              lt: 5,
            },
          },
        }),

        this.prisma.pushDelivery.count({
          where: {
            deliveredAt:
              null,
            attempts: {
              gte: 5,
            },
          },
        }),

        this.prisma.systemBackupRun.findFirst({
          orderBy: {
            completedAt:
              'desc',
          },
        }),

        this.prisma.systemBackupRun.findFirst({
          where: {
            status:
              'SUCCESS',
          },

          orderBy: {
            completedAt:
              'desc',
          },
        }),

        this.prisma.systemBackupRun.findFirst({
          where: {
            status:
              'FAILED',
          },

          orderBy: {
            completedAt:
              'desc',
          },
        }),

        this.prisma.matchDispute.count({
          where: {
            status:
              'OPEN',
          },
        }),

        this.prisma.resultSubmission.count({
          where: {
            status:
              'PENDING_VERIFICATION',
          },
        }),
      ]);

    const memory =
      process.memoryUsage();

    const backupAgeHours =
      latestSuccessfulBackup
        ? Number(
            (
              (
                now.getTime() -
                latestSuccessfulBackup
                  .completedAt
                  .getTime()
              ) /
              3_600_000
            ).toFixed(
              1,
            ),
          )
        : null;

    const backupHealthy =
      backupAgeHours !==
        null &&
      backupAgeHours <=
        30;

    return {
      success: true,

      data: {
        status:
          databaseLatencyMs <
            1000
            ? 'HEALTHY'
            : 'DEGRADED',

        checkedAt:
          now,

        runtime: {
          environment:
            process.env
              .NODE_ENV ??
            'development',
          node:
            process.version,
          uptimeSeconds:
            Math.floor(
              process.uptime(),
            ),
          memory: {
            rssMb:
              this.toMb(
                memory.rss,
              ),
            heapUsedMb:
              this.toMb(
                memory.heapUsed,
              ),
            heapTotalMb:
              this.toMb(
                memory.heapTotal,
              ),
          },
        },

        database: {
          connected:
            true,
          latencyMs:
            databaseLatencyMs,
        },

        auth: {
          activeSessions,
        },

        push: {
          configured:
            process.env
              .PUSH_ENABLED ===
              'true' &&
            Boolean(
              process.env
                .FIREBASE_ADMIN_CREDENTIALS_JSON,
            ),
          devices:
            pushDevices,
          pendingDeliveries:
            pendingPushDeliveries,
          failedDeliveries:
            failedPushDeliveries,
        },

        moderation: {
          openDisputes,
          pendingResults,
        },

        backup: {
          reportingConfigured:
            Boolean(
              process.env
                .BACKUP_REPORT_TOKEN,
            ),
          healthy:
            backupHealthy,
          ageHours:
            backupAgeHours,
          latest:
            latestBackup
              ? this.backupView(
                  latestBackup,
                )
              : null,
          latestSuccess:
            latestSuccessfulBackup
              ? this.backupView(
                  latestSuccessfulBackup,
                )
              : null,
          latestFailure:
            lastFailedBackup
              ? this.backupView(
                  lastFailedBackup,
                )
              : null,
        },
      },

      error: null,
    };
  }

  async listAndroidReleases(
    userId: string,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    const releases =
      await this.prisma.androidRelease.findMany({
        include: {
          createdBy: {
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
        },

        orderBy: [
          {
            versionCode:
              'desc',
          },
          {
            createdAt:
              'desc',
          },
        ],

        take: 100,
      });

    return {
      success: true,

      data: {
        releases:
          releases.map(
            (
              release,
            ) => ({
              ...release,

              createdBy: {
                id:
                  release
                    .createdBy
                    .id,
                name:
                  release
                    .createdBy
                    .player
                    ?.identity
                    ?.inGameName ??
                  release
                    .createdBy
                    .fullName,
              },
            }),
          ),
      },

      error: null,
    };
  }

  async createAndroidRelease(
    userId: string,
    dto:
      CreateAndroidReleaseDto,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    this.assertReleasePolicy(
      dto.versionCode,
      dto.minimumSupportedVersionCode,
      dto.forceUpdateBelowVersionCode,
    );

    const existing =
      await this.prisma.androidRelease.findUnique({
        where: {
          versionCode:
            dto.versionCode,
        },
      });

    if (
      existing
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ANDROID_VERSION_CODE_EXISTS',

          message:
            'This Android versionCode already exists in the release registry.',
        },
      });
    }

    const release =
      await this.prisma.androidRelease.create({
        data: {
          versionCode:
            dto.versionCode,
          versionName:
            dto.versionName
              .trim(),
          channel:
            dto.channel,
          minimumSupportedVersionCode:
            dto.minimumSupportedVersionCode ??
            null,
          forceUpdateBelowVersionCode:
            dto.forceUpdateBelowVersionCode ??
            null,
          releaseNotes:
            dto.releaseNotes
              ?.trim() ||
            null,
          playStoreUrl:
            dto.playStoreUrl
              ?.trim() ||
            null,
          sourceCommit:
            dto.sourceCommit
              ?.toLowerCase() ??
            null,
          artifactSha256:
            dto.artifactSha256
              ?.toLowerCase() ??
            null,
          createdByUserId:
            userId,
        },
      });

    await this.recordAudit(
      userId,
      'ANDROID_RELEASE_CREATED',
      release.id,
      {
        versionCode:
          release.versionCode,
        versionName:
          release.versionName,
        channel:
          release.channel,
      },
    );

    return {
      success: true,

      data: {
        release,
      },

      error: null,
    };
  }

  async updateAndroidRelease(
    userId: string,
    releaseId: string,
    dto:
      UpdateAndroidReleaseDto,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    const release =
      await this.requireAndroidRelease(
        releaseId,
      );

    if (
      release.status ===
        'PUBLISHED' ||
      release.status ===
        'SUPERSEDED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ANDROID_RELEASE_LOCKED',

          message:
            'Published or superseded Android release records are immutable.',
        },
      });
    }

    this.assertReleasePolicy(
      release.versionCode,
      dto.minimumSupportedVersionCode ??
        release.minimumSupportedVersionCode ??
        undefined,
      dto.forceUpdateBelowVersionCode ??
        release.forceUpdateBelowVersionCode ??
        undefined,
    );

    const updated =
      await this.prisma.androidRelease.update({
        where: {
          id:
            release.id,
        },

        data: {
          channel:
            dto.channel,
          status:
            dto.status,
          minimumSupportedVersionCode:
            dto.minimumSupportedVersionCode,
          forceUpdateBelowVersionCode:
            dto.forceUpdateBelowVersionCode,
          releaseNotes:
            dto.releaseNotes ===
            undefined
              ? undefined
              : dto.releaseNotes
                  .trim() ||
                null,
          playStoreUrl:
            dto.playStoreUrl ===
            undefined
              ? undefined
              : dto.playStoreUrl
                  .trim() ||
                null,
          sourceCommit:
            dto.sourceCommit ===
            undefined
              ? undefined
              : dto.sourceCommit
                  .toLowerCase(),
          artifactSha256:
            dto.artifactSha256 ===
            undefined
              ? undefined
              : dto.artifactSha256
                  .toLowerCase(),
        },
      });

    await this.recordAudit(
      userId,
      'ANDROID_RELEASE_UPDATED',
      updated.id,
      {
        versionCode:
          updated.versionCode,
        channel:
          updated.channel,
        status:
          updated.status,
      },
    );

    return {
      success: true,

      data: {
        release:
          updated,
      },

      error: null,
    };
  }

  async publishAndroidRelease(
    userId: string,
    releaseId: string,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    const release =
      await this.requireAndroidRelease(
        releaseId,
      );

    if (
      release.status ===
      'PUBLISHED'
    ) {
      return {
        success: true,

        data: {
          release,
        },

        error: null,
      };
    }

    if (
      release.status !==
      'READY'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ANDROID_RELEASE_NOT_READY',

          message:
            'Mark the Android release READY before publishing it.',
        },
      });
    }

    const latest =
      await this.prisma.androidRelease.findFirst({
        where: {
          channel:
            release.channel,
          status:
            'PUBLISHED',
        },

        orderBy: {
          versionCode:
            'desc',
        },
      });

    if (
      latest &&
      latest.versionCode >=
        release.versionCode
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ANDROID_VERSION_NOT_MONOTONIC',

          message:
            'A published release in this channel already has an equal or higher versionCode.',
        },
      });
    }

    const published =
      await this.prisma.$transaction(
        async (
          tx,
        ) => {
          await tx.androidRelease.updateMany({
            where: {
              channel:
                release.channel,
              status:
                'PUBLISHED',
            },

            data: {
              status:
                'SUPERSEDED',
            },
          });

          return tx.androidRelease.update({
            where: {
              id:
                release.id,
            },

            data: {
              status:
                'PUBLISHED',
              publishedAt:
                new Date(),
            },
          });
        },
        {
          isolationLevel:
            'Serializable',
        },
      );

    await this.recordAudit(
      userId,
      'ANDROID_RELEASE_PUBLISHED',
      published.id,
      {
        versionCode:
          published.versionCode,
        versionName:
          published.versionName,
        channel:
          published.channel,
      },
    );

    return {
      success: true,

      data: {
        release:
          published,
      },

      error: null,
    };
  }

  async androidVersionPolicy(
    rawVersionCode?: string,
  ) {
    const installed =
      Number(
        rawVersionCode,
      );

    const installedVersionCode =
      Number.isInteger(
        installed,
      ) &&
      installed >
        0
        ? installed
        : null;

    const release =
      await this.prisma.androidRelease.findFirst({
        where: {
          channel:
            'PRODUCTION',
          status:
            'PUBLISHED',
        },

        orderBy: {
          versionCode:
            'desc',
        },
      });

    if (
      !release
    ) {
      return {
        success: true,

        data: {
          updateAvailable:
            false,
          forceUpdate:
            false,
          latest:
            null,
        },

        error: null,
      };
    }

    const updateAvailable =
      installedVersionCode !==
        null &&
      installedVersionCode <
        release.versionCode;

    const forceUpdate =
      updateAvailable &&
      release.forceUpdateBelowVersionCode !==
        null &&
      installedVersionCode! <
        release.forceUpdateBelowVersionCode;

    return {
      success: true,

      data: {
        updateAvailable,
        forceUpdate,

        latest: {
          versionCode:
            release.versionCode,
          versionName:
            release.versionName,
          minimumSupportedVersionCode:
            release.minimumSupportedVersionCode,
          forceUpdateBelowVersionCode:
            release.forceUpdateBelowVersionCode,
          releaseNotes:
            release.releaseNotes,
          playStoreUrl:
            release.playStoreUrl ??
            'https://play.google.com/store/apps/details?id=in.fcarena.app',
          publishedAt:
            release.publishedAt,
        },
      },

      error: null,
    };
  }

  async recordBackup(
    reportToken:
      string | undefined,
    dto:
      BackupReportDto,
  ) {
    this.assertBackupToken(
      reportToken,
    );

    const startedAt =
      new Date(
        dto.startedAt,
      );

    const completedAt =
      new Date(
        dto.completedAt,
      );

    if (
      completedAt <
      startedAt
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'BACKUP_REPORT_TIME_INVALID',

          message:
            'Backup completion time cannot be before its start time.',
        },
      });
    }

    if (
      dto.status ===
        'SUCCESS' &&
      (
        !dto.checksumSha256 ||
        !dto.sizeBytes
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'BACKUP_SUCCESS_METADATA_REQUIRED',

          message:
            'Successful backup reports must include sizeBytes and checksumSha256.',
        },
      });
    }

    const run =
      await this.prisma.systemBackupRun.create({
        data: {
          status:
            dto.status,
          startedAt,
          completedAt,
          sizeBytes:
            dto.sizeBytes ??
            null,
          checksumSha256:
            dto.checksumSha256
              ?.toLowerCase() ??
            null,
          storageKind:
            dto.storageKind
              ?.trim()
              .toUpperCase() ||
            'LOCAL',
          retentionDays:
            dto.retentionDays ??
            14,
          sourceHost:
            dto.sourceHost
              ?.trim() ||
            null,
          errorMessage:
            dto.errorMessage
              ?.trim() ||
            null,
        },
      });

    return {
      success: true,

      data: {
        id:
          run.id,
        status:
          run.status,
        completedAt:
          run.completedAt,
      },

      error: null,
    };
  }

  private async adminScope(
    userId: string,
  ): Promise<
    AdminScope
  > {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          role: true,

          leagueAdminRoles: {
            select: {
              leagueId: true,
            },
          },
        },
      });

    if (
      !user
    ) {
      throw this.adminRequired();
    }

    if (
      user.role ===
      'SUPER_ADMIN'
    ) {
      return {
        superAdmin:
          true,
        leagueIds: [],
      };
    }

    const leagueIds =
      [
        ...new Set(
          user.leagueAdminRoles.map(
            (
              role,
            ) =>
              role.leagueId,
          ),
        ),
      ];

    if (
      leagueIds.length ===
      0
    ) {
      throw this.adminRequired();
    }

    return {
      superAdmin:
        false,
      leagueIds,
    };
  }

  private async assertSuperAdmin(
    userId: string,
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

    if (
      user?.role !==
      'SUPER_ADMIN'
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'SUPER_ADMIN_REQUIRED',

          message:
            'FC Arena SUPER_ADMIN access is required.',
        },
      });
    }
  }

  private adminRequired() {
    return new ForbiddenException({
      success: false,
      data: null,

      error: {
        code:
          'ADMIN_ACCESS_REQUIRED',

        message:
          'League Admin or SUPER_ADMIN access is required.',
      },
    });
  }

  private assertReleasePolicy(
    versionCode: number,
    minimumSupported?:
      number,
    forceBelow?:
      number,
  ) {
    if (
      minimumSupported !==
        undefined &&
      minimumSupported >
        versionCode
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ANDROID_MIN_VERSION_INVALID',

          message:
            'minimumSupportedVersionCode cannot be higher than this release versionCode.',
        },
      });
    }

    if (
      forceBelow !==
        undefined &&
      forceBelow >
        versionCode
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ANDROID_FORCE_VERSION_INVALID',

          message:
            'forceUpdateBelowVersionCode cannot be higher than this release versionCode.',
        },
      });
    }
  }

  private async requireAndroidRelease(
    releaseId: string,
  ) {
    const release =
      await this.prisma.androidRelease.findUnique({
        where: {
          id:
            releaseId,
        },
      });

    if (
      !release
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'ANDROID_RELEASE_NOT_FOUND',

          message:
            'Android release record could not be found.',
        },
      });
    }

    return release;
  }

  private assertBackupToken(
    supplied:
      string | undefined,
  ) {
    const expected =
      process.env
        .BACKUP_REPORT_TOKEN;

    if (
      !expected
    ) {
      throw new ServiceUnavailableException({
        success: false,
        data: null,

        error: {
          code:
            'BACKUP_REPORTING_DISABLED',

          message:
            'Backup reporting is not configured.',
        },
      });
    }

    if (
      !supplied
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'BACKUP_REPORT_TOKEN_INVALID',

          message:
            'Backup report authentication failed.',
        },
      });
    }

    const suppliedBuffer =
      Buffer.from(
        supplied,
      );

    const expectedBuffer =
      Buffer.from(
        expected,
      );

    if (
      suppliedBuffer.length !==
        expectedBuffer.length ||
      !timingSafeEqual(
        suppliedBuffer,
        expectedBuffer,
      )
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'BACKUP_REPORT_TOKEN_INVALID',

          message:
            'Backup report authentication failed.',
        },
      });
    }
  }

  private async recordAudit(
    userId: string,
    action: string,
    targetId: string,
    metadata:
      Record<
        string,
        unknown
      >,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          userId,
        action,
        targetType:
          'AndroidRelease',
        targetId,
        scopeType:
          'GLOBAL',
        scopeId:
          'ANDROID',
        metadata:
          metadata as any,
      },
    });
  }

  private backupView(
    backup:
      any,
  ) {
    return {
      id:
        backup.id,
      status:
        backup.status,
      startedAt:
        backup.startedAt,
      completedAt:
        backup.completedAt,
      sizeBytes:
        backup.sizeBytes,
      checksumSha256:
        backup.checksumSha256,
      storageKind:
        backup.storageKind,
      retentionDays:
        backup.retentionDays,
      sourceHost:
        backup.sourceHost,
      errorMessage:
        backup.errorMessage,
    };
  }

  private emptySeries(
    start:
      Date,
    days:
      number,
  ) {
    return Array.from(
      {
        length:
          days,
      },
      (
        _,
        index,
      ) => {
        const day =
          new Date(
            start,
          );

        day.setDate(
          day.getDate() +
            index,
        );

        return {
          day:
            this.dayKey(
              day,
            ),
          newPlayers:
            0,
          confirmedResults:
            0,
        };
      },
    );
  }

  private dayKey(
    value:
      Date,
  ) {
    return value
      .toISOString()
      .slice(
        0,
        10,
      );
  }

  private toMb(
    bytes:
      number,
  ) {
    return Number(
      (
        bytes /
        1024 /
        1024
      ).toFixed(
        1,
      ),
    );
  }
}
