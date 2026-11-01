import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import type { PrismaService } from '../database/prisma.service.js';

function setup() {
  const notifications = [
    {
      id: 'result',
      userId: 'alice',
      type: 'RESULT_CONFIRMED',
      readAt: null,
      dedupeKey: 'alice:confirmed',
    },
    {
      id: 'activity',
      userId: 'alice',
      type: 'FIXTURE_CREATED',
      readAt: null,
      dedupeKey: 'alice:fixture',
    },
    {
      id: 'private',
      userId: 'bob',
      type: 'RESULT_CONFIRMED',
      readAt: null,
      dedupeKey: 'bob:confirmed',
    },
  ];
  const notification = {
    findMany: vi.fn(async ({ where }: any) =>
      notifications.filter(
        (n) =>
          n.userId === where.userId &&
          (!Object.hasOwn(where, 'readAt') ||
            (where.readAt === null ? !n.readAt : !!n.readAt)) &&
          (!where.type || where.type.in.includes(n.type)),
      ),
    ),
    count: vi.fn(
      async ({ where }: any) =>
        notifications.filter((n) => n.userId === where.userId && !n.readAt)
          .length,
    ),
    findFirst: vi.fn(async ({ where }: any) =>
      notifications.find((n) => n.id === where.id && n.userId === where.userId),
    ),
    update: vi.fn(async ({ where, data }: any) =>
      Object.assign(
        notifications.find((n) => n.id === where.id)!,
        data,
      ),
    ),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const matched = notifications.filter(
        (n) => n.userId === where.userId && !n.readAt,
      );
      matched.forEach((n) => Object.assign(n, data));
      return { count: matched.length };
    }),
    upsert: vi.fn(async ({ where, update }: any) =>
      Object.assign(
        notifications.find((n) => n.dedupeKey === where.dedupeKey)!,
        update,
      ),
    ),
  };
  const prisma = {
    notification,
    user: { findUnique: vi.fn(async () => ({ notificationPreferences: {} })) },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const service = new NotificationsService(prisma as unknown as PrismaService);
  const sync = vi.spyOn(service, 'syncForUser').mockResolvedValue(undefined);
  return { service, prisma, sync, notifications };
}

describe('notification inbox, results and history', () => {
  it('filters results in the database before limiting the list', async () => {
    const { service, prisma } = setup();
    const response = await service.getNotifications('alice', false, 'results');
    expect(response.data).toMatchObject({
      notifications: [{ id: 'result' }],
      unreadCount: 2,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'alice',
          readAt: null,
          type: {
            in: [
              'RESULT_SUBMITTED',
              'RESULT_REJECTED',
              'RESULT_CONFIRMED',
              'STATISTICS_UPDATED',
            ],
          },
        },
        take: 100,
      }),
    );
  });

  it('moves cleared results to history and never resurrects them on event upsert', async () => {
    const { service } = setup();
    await service.markAsRead('alice', 'result');
    await service.createForUser('alice', {
      type: 'RESULT_CONFIRMED',
      title: 'Confirmed',
      message: '2-1',
      dedupeKey: 'confirmed',
      eventAt: new Date(),
    });
    expect(
      (await service.getNotifications('alice', false, 'inbox')).data
        .notifications,
    ).toMatchObject([{ id: 'activity' }]);
    expect(
      (await service.getNotifications('alice', false, 'results')).data
        .notifications,
    ).toEqual([]);
    expect(
      (await service.getNotifications('alice', false, 'history')).data
        .notifications,
    ).toMatchObject([{ id: 'result', readAt: expect.any(Date) }]);
    expect((await service.getNotifications('alice', true)).data).toEqual({
      unreadCount: 1,
    });
  });

  it('waits for synchronization before clearing the entire inbox', async () => {
    const { service, prisma, sync } = setup();
    await service.markAllAsRead('alice');
    expect(sync.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.notification.updateMany.mock.invocationCallOrder[0],
    );
    expect(
      (await service.getNotifications('alice', false, 'inbox')).data
        .notifications,
    ).toEqual([]);
    expect(
      (await service.getNotifications('alice', false, 'history')).data
        .notifications,
    ).toHaveLength(2);
    expect((await service.getNotifications('bob', true)).data).toEqual({
      unreadCount: 1,
    });
  });

  it('does not clear another user’s notification', async () => {
    const { service, prisma } = setup();
    await expect(service.markAsRead('alice', 'private')).rejects.toThrow();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('rejects unsupported views without querying user data', async () => {
    const { service, sync } = setup();
    await expect(
      service.getNotifications('alice', false, 'invalid'),
    ).rejects.toThrow('Unknown notification view');
    expect(sync).not.toHaveBeenCalled();
  });
});
