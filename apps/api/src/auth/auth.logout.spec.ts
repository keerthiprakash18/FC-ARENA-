import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

describe('Logout revocation', () => {
  function fixture() {
    process.env.JWT_ACCESS_SECRET = 'test-access-only';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-only';
    const prisma = { refreshSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ type: 'refresh', sub: 'user-1', sid: 'session-1' }) };
    return { prisma, jwt, service: new AuthService(prisma as never, jwt as never, {} as never) };
  }
  it('revokes only the signed session belonging to the signed user', async () => {
    const f = fixture();
    await f.service.logout('test-token');
    expect(f.prisma.refreshSession.updateMany).toHaveBeenCalledWith({ where: { id: 'session-1', userId: 'user-1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });
  it('does not report successful logout when session storage fails', async () => {
    const f = fixture();
    f.prisma.refreshSession.updateMany.mockRejectedValue(new Error('storage unavailable'));
    await expect(f.service.logout('test-token')).rejects.toThrow('storage unavailable');
  });
  it('keeps logout idempotent for an invalid token', async () => {
    const f = fixture();
    f.jwt.verifyAsync.mockRejectedValue(new Error('expired'));
    await expect(f.service.logout('test-token')).resolves.toMatchObject({ success: true });
    expect(f.prisma.refreshSession.updateMany).not.toHaveBeenCalled();
  });
});
