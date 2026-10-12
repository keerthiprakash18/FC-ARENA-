import { describe, it, expect, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import type { PrismaService } from '../database/prisma.service.js';

function setup() {
  const rows = Array.from({ length: 100 }, (_, i) => ({ id: `n-${i}`, title: 'Match result', message: 'Your fixture result is available.', href: `/matches/${i}`, userId: 'alice' }));
  const prisma = {
    notification: { findMany: vi.fn().mockResolvedValue(rows), count: vi.fn().mockResolvedValue(7) },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const service = new NotificationsService(prisma as unknown as PrismaService);
  const sync = vi.spyOn(service, 'syncForUser').mockResolvedValue(undefined);
  return { service, prisma, sync };
}

describe('notification badge query budget', () => {
  it('syncs and counts only the authenticated user without fetching inbox rows', async () => {
    const { service, prisma, sync } = setup();
    expect(await service.getNotifications('alice', true)).toEqual({ success: true, data: { unreadCount: 7 }, error: null });
    expect(sync).toHaveBeenCalledWith('alice');
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'alice', readAt: null } });
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('preserves the old inbox contract and measures serialized payload reduction', async () => {
    const { service, prisma } = setup();
    const full = await service.getNotifications('alice');
    const summary = await service.getNotifications('alice', true);
    expect(full.data).toHaveProperty('notifications');
    expect(prisma.notification.findMany).toHaveBeenCalledWith({ where: { userId: 'alice' }, orderBy: { eventAt: 'desc' }, take: 100 });
    const before = Buffer.byteLength(JSON.stringify(full));
    const after = Buffer.byteLength(JSON.stringify(summary));
    expect(after).toBeLessThan(before / 10);
    console.info(`Synthetic 100-record inbox: ${before} -> ${after} bytes; post-sync queries: 2 -> 1`);
  });

  it('does not return a stale count when synchronization fails', async () => {
    const { service, prisma, sync } = setup();
    sync.mockRejectedValueOnce(new Error('synthetic sync failure'));
    await expect(service.getNotifications('alice', true)).rejects.toThrow('synthetic sync failure');
    expect(prisma.notification.count).not.toHaveBeenCalled();
  });
});

describe('concurrent notification synchronization', () => {
  it('shares overlapping work per user, never between accounts, and releases failures', async () => {
    const service = new NotificationsService({} as PrismaService);
    let finish!: () => void;
    const work = vi.spyOn(service as unknown as { synchronizeForUser(id: string): Promise<void> }, 'synchronizeForUser')
      .mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = service.syncForUser('alice');
    const second = service.syncForUser('alice');
    expect(second).toBe(first);
    expect(work).toHaveBeenCalledTimes(1);
    finish();
    await first;
    work.mockResolvedValue(undefined);
    await Promise.all([service.syncForUser('alice'), service.syncForUser('bob')]);
    expect(work).toHaveBeenCalledTimes(3);
    work.mockRejectedValueOnce(new Error('temporary'));
    await expect(service.syncForUser('alice')).rejects.toThrow('temporary');
    await service.syncForUser('alice');
    expect(work).toHaveBeenCalledTimes(5);
  });
});
