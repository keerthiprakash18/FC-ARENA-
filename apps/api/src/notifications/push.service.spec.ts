import { describe, it, expect, vi } from 'vitest';
import { PushService } from './push.service.js';
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));
const { send } = vi.hoisted(() => ({
  send: vi.fn().mockResolvedValue('sent'),
}));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ send }) }));
describe('Push session and delivery isolation', () => {
  it('does not register a device when the sender is not configured', async () => {
    const service = new PushService({} as any, {} as any);
    expect(service.status().data.configured).toBe(false);
    await expect(service.register('user', 'session', 'token')).rejects.toThrow(
      'not available',
    );
  });
  it('rejects expired or revoked sessions before persisting a token', async () => {
    const prisma: any = {
      refreshSession: { findFirst: vi.fn().mockResolvedValue(null) },
      pushDevice: { upsert: vi.fn() },
    };
    const service = new PushService(prisma, {} as any);
    (service as any).app = {};
    await expect(service.register('user', 'session', 'token')).rejects.toThrow(
      'Sign in again',
    );
    expect(prisma.pushDevice.upsert).not.toHaveBeenCalled();
  });
  it('does not deliver when consent or session is revoked during sync', async () => {
    send.mockClear();
    const device = {
      id: 'device',
      userId: 'user',
      sessionId: 'session',
      enabledAt: new Date(),
      token: 'token',
    };
    const prisma: any = {
      pushDevice: {
        findMany: vi.fn().mockResolvedValue([device]),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      notification: { findMany: vi.fn().mockResolvedValue([{ id: 'notice' }]) },
    };
    const service = new PushService(prisma, { syncForUser: vi.fn() } as any);
    (service as any).app = {};
    await service.tick();
    expect(send).not.toHaveBeenCalled();
    expect(
      prisma.pushDevice.findMany.mock.calls[0][0].where.session.revokedAt,
    ).toBeNull();
  });
  it('scopes device disabling to the authenticated owner', async () => {
    const prisma: any = { pushDevice: { deleteMany: vi.fn() } };
    await new PushService(prisma, {} as any).disable('owner', 'token');
    expect(prisma.pushDevice.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'owner', token: 'token' },
    });
  });
});
