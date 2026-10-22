import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import type { PrismaService } from '../database/prisma.service.js';

function setup(notificationPreferences: unknown = null) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ notificationPreferences }),
      update: vi.fn().mockResolvedValue({}),
    },
    notification: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
  return { prisma, service: new NotificationsService(prisma as unknown as PrismaService) };
}

describe('notification preferences', () => {
  it('keeps every category enabled by default and preserves notification creation', async () => {
    const { prisma, service } = setup();
    const result = await service.getPreferences('user-1');

    expect(result.data.preferences).toEqual({
      matchReminders: true,
      leagueActivity: true,
      tournamentActivity: true,
      resultUpdates: true,
      disputeUpdates: true,
      achievements: true,
      fairPlayUpdates: true,
    });

    await service.createForUser('user-1', {
      type: 'MATCH_REMINDER',
      title: 'Reminder',
      message: 'Match ready',
      dedupeKey: 'match-1',
      eventAt: new Date(),
    });
    expect(prisma.notification.upsert).toHaveBeenCalledTimes(1);
  });

  it('skips only opted-out categories while allowing other delivery to continue', async () => {
    const { prisma, service } = setup({ matchReminders: false });

    await service.createForUser('user-1', {
      type: 'MATCH_REMINDER',
      title: 'Reminder',
      message: 'Match ready',
      dedupeKey: 'match-1',
      eventAt: new Date(),
    });
    await service.createForUser('user-1', {
      type: 'RESULT_CONFIRMED',
      title: 'Confirmed',
      message: 'Result confirmed',
      dedupeKey: 'result-1',
      eventAt: new Date(),
    });

    expect(prisma.notification.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.notification.upsert.mock.calls[0][0].create.type).toBe('RESULT_CONFIRMED');
  });

  it('merges partial updates with existing preferences', async () => {
    const { prisma, service } = setup({ leagueActivity: false });
    const result = await service.updatePreferences('user-1', { achievements: false });

    expect(result.data.preferences.leagueActivity).toBe(false);
    expect(result.data.preferences.achievements).toBe(false);
    expect(result.data.preferences.matchReminders).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { notificationPreferences: result.data.preferences },
    }));
  });
});
