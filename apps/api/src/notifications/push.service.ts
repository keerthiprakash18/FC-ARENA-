import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private app: App | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(PushService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}
  onModuleInit() {
    if (process.env.PUSH_ENABLED !== 'true') return;
    try {
      const value = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
      if (!value) return;
      this.app = initializeApp(
        { credential: cert(JSON.parse(value)) },
        'fc-arena-push',
      );
      this.timer = setInterval(() => {
        void this.tick();
      }, 30_000);
      this.timer.unref();
    } catch {
      this.logger.warn(
        'Push credentials are not configured correctly; push remains disabled.',
      );
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async status(
    userId: string,
    sessionId:
      string | undefined,
  ) {
    const boundDevices =
      sessionId
        ? await this.prisma.pushDevice.count({
            where: {
              userId,
              sessionId,
              session: {
                revokedAt: null,
                expiresAt: {
                  gt: new Date(),
                },
              },
            },
          })
        : 0;

    return {
      success: true,
      data: {
        configured:
          this.app !== null,
        bound:
          boundDevices > 0,
        boundDevices,
      },
      error: null,
    };
  }
  async register(userId: string, sessionId: string | undefined, token: string) {
    if (!this.app)
      throw new ServiceUnavailableException(
        'Phone notifications are not available yet.',
      );
    if (
      !sessionId ||
      !(await this.prisma.refreshSession.findFirst({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }))
    )
      throw new BadRequestException(
        'Sign in again before enabling phone notifications.',
      );
    await this.prisma.pushDevice.deleteMany({
      where: {
        userId,
        session: {
          OR: [
            { revokedAt: { not: null } },
            { expiresAt: { lte: new Date() } },
          ],
        },
      },
    });
    const existing = await this.prisma.pushDevice.findUnique({
      where: { token },
    });
    if (
      !existing &&
      (await this.prisma.pushDevice.count({ where: { userId } })) >= 10
    )
      throw new BadRequestException(
        'Too many registered devices. Disable notifications on an older device first.',
      );
    const sameSession =
      existing?.userId === userId && existing?.sessionId === sessionId;
    await this.prisma.pushDevice.upsert({
      where: { token },
      create: {
        userId,
        sessionId,
        token,
        lastSyncedAt:
          new Date(0),
      },
      update: {
        userId,
        sessionId,
        lastSyncedAt:
          new Date(0),
        ...(sameSession
          ? {}
          : {
              enabledAt:
                new Date(),
            }),
      },
    });
    return { success: true, data: { enabled: true }, error: null };
  }
  async disable(
    userId: string,
    token: string,
  ) {
    await this.prisma.pushDevice.deleteMany({
      where: {
        userId,
        token,
      },
    });

    return {
      success: true,
      data: {
        enabled: false,
      },
      error: null,
    };
  }

  async disableSession(
    userId: string,
    sessionId:
      string | undefined,
  ) {
    if (
      !sessionId
    ) {
      return {
        success: true,
        data: {
          enabled: false,
          removed: 0,
        },
        error: null,
      };
    }

    const removed =
      await this.prisma.pushDevice.deleteMany({
        where: {
          userId,
          sessionId,
        },
      });

    return {
      success: true,
      data: {
        enabled: false,
        removed:
          removed.count,
      },
      error: null,
    };
  }

  private async pruneDevices(
    now: Date,
  ) {
    const staleBefore =
      new Date(
        now.getTime() -
          90 *
            24 *
            60 *
            60 *
            1000,
      );

    await this.prisma.pushDevice.deleteMany({
      where: {
        OR: [
          {
            session: {
              OR: [
                {
                  revokedAt: {
                    not: null,
                  },
                },
                {
                  expiresAt: {
                    lte: now,
                  },
                },
              ],
            },
          },
          {
            lastSyncedAt: {
              lt:
                staleBefore,
            },
          },
        ],
      },
    });
  }

  async tick() {
    if (this.running || !this.app) return;
    this.running = true;
    try {
      const now = new Date();

      await this.pruneDevices(
        now,
      );

      const devices = await this.prisma.pushDevice.findMany({
        where: {
          user: { status: 'ACTIVE' },
          session: { revokedAt: null, expiresAt: { gt: now } },
        },
        orderBy: { lastSyncedAt: 'asc' },
        take: 20,
      });
      for (const device of devices) {
        try {
          await this.prisma.pushDevice.update({
            where: { id: device.id },
            data: { lastSyncedAt: new Date() },
          });
          await this.notifications.syncForUser(device.userId);
          const since = new Date(
            Math.max(device.enabledAt.getTime(), Date.now() - 48 * 3600_000),
          );
          const items = await this.prisma.notification.findMany({
            where: {
              userId: device.userId,
              readAt: null,
              eventAt: { gte: since, lte: new Date() },
            },
            orderBy: { eventAt: 'desc' },
            take: 50,
          });
          for (const item of items) {
            // Recheck consent/session immediately before delivery, including logout during a sync.
            if (
              !(await this.prisma.pushDevice.findFirst({
                where: {
                  id: device.id,
                  userId: device.userId,
                  sessionId: device.sessionId,
                  session: { revokedAt: null, expiresAt: { gt: new Date() } },
                },
              }))
            )
              break;
            await this.prisma.pushDelivery.createMany({
              data: [{ deviceId: device.id, notificationId: item.id }],
              skipDuplicates: true,
            });
            const where = {
              deviceId: device.id,
              notificationId: item.id,
              deliveredAt: null,
              attempts: { lt: 5 },
              leaseUntil: { lte: new Date() },
            };
            const claimed = await this.prisma.pushDelivery.updateMany({
              where,
              data: {
                attempts: { increment: 1 },
                leaseUntil: new Date(Date.now() + 120_000),
              },
            });
            if (!claimed.count) continue;
            try {
              const href =
                item.href?.startsWith('/') && !item.href.startsWith('//')
                  ? item.href
                  : '/notifications';
              const urgent =
                [
                  'MATCH_REMINDER',
                  'MATCH_READY',
                  'RESULT_SUBMITTED',
                  'RESULT_REJECTED',
                  'DISPUTE_OPENED',
                ].includes(
                  item.type,
                );

              await getMessaging(this.app).send({
                token: device.token,
                notification: {
                  title: item.title,
                  body: item.message,
                },
                data: { href, notificationId: item.id },
                android: {
                  priority:
                    urgent
                      ? 'high'
                      : 'normal',
                  ttl:
                    urgent
                      ? 900_000
                      : 300_000,
                  notification: { channelId: 'competition', tag: item.id },
                },
              });
              await this.prisma.pushDelivery.updateMany({
                where: { deviceId: device.id, notificationId: item.id },
                data: { deliveredAt: new Date() },
              });
            } catch (error) {
              const code = (error as { code?: string }).code;
              if (
                code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token'
              ) {
                await this.prisma.pushDevice.deleteMany({
                  where: { id: device.id },
                });
                break;
              }
              this.logger.warn('Push delivery will retry.');
            }
          }
        } catch {
          this.logger.warn(
            'Device notification sync failed; a later cycle will retry.',
          );
        }
      }
    } catch {
      this.logger.warn('Push worker unavailable; a later cycle will retry.');
    } finally {
      this.running = false;
    }
  }
}
