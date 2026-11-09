import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import type { PrismaService } from '../database/prisma.service.js';

function setup() {
  const notifications: Array<{
    id: string;
    userId: string;
    type: string;
    readAt: Date | null;
    dedupeKey: string;
    entityType?: string;
    entityId?: string;
  }> = [
    {
      id: 'result',
      userId: 'alice',
      type: 'RESULT_CONFIRMED',
      readAt: null,
      dedupeKey: 'alice:confirmed',
      entityType: 'ResultSubmission',
      entityId: 'confirmed-result',
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
      entityType: 'ResultSubmission',
      entityId: 'private-result',
    },
  ];
  const notification = {
    findMany: vi.fn(async ({ where, take }: any) =>
      notifications.filter(
        (n) =>
          n.userId === where.userId &&
          (!Object.hasOwn(where, 'readAt') ||
            (where.readAt === null ? !n.readAt : !!n.readAt)) &&
          (!where.type || (typeof where.type === 'string' ? n.type === where.type : where.type.in.includes(n.type))) &&
          (!where.entityType || n.entityType === where.entityType) &&
          (!where.entityId || n.entityId != null) &&
          (!where.id || where.id.in.includes(n.id)),
      ).slice(0, take),
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
    resultSubmission: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn(async () => ({ notificationPreferences: {} })) },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const service = new NotificationsService(prisma as unknown as PrismaService);
  const sync = vi.spyOn(service, 'syncForUser').mockResolvedValue(undefined);
  return { service, prisma, sync, notifications };
}

describe('notification inbox, results and history', () => {
  it('creates confirmation alerts for league admins who reviewed other players’ results', async () => {
    const prisma = {
      ...Object.fromEntries([
        'leagueApplication', 'leagueMember', 'tournament', 'tournamentRegistration',
        'fixture', 'matchDispute', 'achievement', 'seasonalAward',
      ].map((model) => [model, { findMany: vi.fn().mockResolvedValue([]) }])),
      leagueAdmin: { findMany: vi.fn().mockResolvedValue([{ leagueId: 'managed-league' }]) },
      resultSubmission: { findMany: vi.fn(async ({ where }: any) => where.status === 'CONFIRMED' ? [{
        id: 'reviewed-result', matchId: 'match', homeScore: 2, awayScore: 1,
        reviewedAt: new Date(), match: { tournamentId: 'cup', tournament: { name: 'Cup' } },
      }] : []) },
      user: { findUnique: vi.fn().mockResolvedValue({ notificationPreferences: {} }) },
      notification: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const service = new NotificationsService(prisma as unknown as PrismaService);
    await service.syncForUser('admin');
    expect(prisma.resultSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'CONFIRMED',
        match: { OR: expect.arrayContaining([{ tournament: { leagueId: { in: ['managed-league'] } } }]) },
      }),
    }));
    expect(prisma.notification.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        userId: 'admin', type: 'RESULT_CONFIRMED', entityId: 'reviewed-result',
      }),
    }));
  });

  it('keeps read pending results visible and excludes submissions already reviewed before applying the limit', async () => {
    const { service, prisma, notifications } = setup();
    for (let index = 0; index < 105; index++) {
      notifications.push({
        id: `pending-${index}`, userId: 'alice', type: 'RESULT_SUBMITTED',
        readAt: new Date(), dedupeKey: `pending-${index}`,
        entityType: 'ResultSubmission', entityId: `submission-${index}`,
      });
    }
    prisma.resultSubmission.findMany.mockResolvedValue([{ id: 'submission-104' }]);
    const response = await service.getNotifications('alice', false, 'pending-results');
    expect(response.data).toMatchObject({
      unreadCount: 2,
      notifications: [{ id: 'pending-104', readAt: expect.any(Date) }],
    });
    expect(prisma.resultSubmission.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: expect.arrayContaining(['submission-0', 'submission-104']) },
        status: 'PENDING_VERIFICATION', match: { confirmedResultSubmissionId: null },
      },
      select: { id: true },
    });
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { userId: 'alice', id: { in: ['pending-104'] } }, take: 100,
    }));
  });

  it('shows only current confirmed results after clearing and scopes lookups to this account', async () => {
    const { service, prisma } = setup();
    prisma.resultSubmission.findMany.mockResolvedValue([{ id: 'confirmed-result' }]);
    await service.markAllAsRead('alice');
    const response = await service.getNotifications('alice', false, 'confirmed-results');
    expect(response.data).toMatchObject({
      unreadCount: 0, notifications: [{ id: 'result', readAt: expect.any(Date) }],
    });
    expect(prisma.resultSubmission.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['confirmed-result'] }, status: 'CONFIRMED',
        confirmedForMatch: { isNot: null },
      },
      select: { id: true },
    });
    // Reversing/replacing a result must also remove its old confirmation alert.
    prisma.resultSubmission.findMany.mockResolvedValue([]);
    expect((await service.getNotifications('alice', false, 'confirmed-results')).data.notifications).toEqual([]);
  });

  it('returns an empty pending list without loading unrelated result submissions', async () => {
    const { service, prisma } = setup();
    expect((await service.getNotifications('alice', false, 'pending-results')).data.notifications).toEqual([]);
    expect(prisma.resultSubmission.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { userId: 'alice', id: { in: [] } },
    }));
  });

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
