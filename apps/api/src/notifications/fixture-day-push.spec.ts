import { describe, expect, it, vi } from 'vitest';
import { PushService } from './push.service.js';
import { FIXTURE_DAY_REMINDER } from './fixture-day-reminders.service.js';
const { send } = vi.hoisted(() => ({
  send: vi.fn().mockResolvedValue('sent'),
}));
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ send }) }));

describe('Phone delivery revalidates daily fixture reminders', () => {
  it.each([true, false, undefined])(
    'checks pending fixtures before claiming or sending: %s',
    async (allowed) => {
      send.mockClear();
      const item = {
        id: 'notice',
        type: 'MATCH_REMINDER',
        title: 'Pending match',
        message: 'Play and submit',
        href: '/matches/m1',
        entityType: FIXTURE_DAY_REMINDER,
        entityId: '2026-11-07:1000',
      };
      const prisma: any = {
        user: { findUnique: vi.fn().mockResolvedValue({ notificationPreferences: null }) },
        pushDevice: {
          deleteMany: vi.fn(),
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'device',
              userId: 'user',
              sessionId: 'session',
              token: 'test-token',
              enabledAt: new Date(0),
            },
          ]),
          update: vi.fn(),
          findFirst: vi.fn().mockResolvedValue({ id: 'device' }),
        },
        notification: { findMany: vi.fn().mockResolvedValue([item]) },
        pushDelivery: {
          createMany: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const eligibility =
        allowed === undefined
          ? undefined
          : { canDeliver: vi.fn().mockResolvedValue(allowed) };
      const service = new PushService(
        prisma,
        { syncForUser: vi.fn() } as any,
        eligibility as any,
      );
      (service as any).app = {};
      await service.tick();
      if (allowed) {
        expect(eligibility!.canDeliver).toHaveBeenCalledWith(
          'user',
          item.entityId,
          item.href,
        );
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0].data.href).toBe('/matches/m1');
      } else {
        expect(send).not.toHaveBeenCalled();
        expect(prisma.pushDelivery.createMany).not.toHaveBeenCalled();
      }
    },
  );
});
