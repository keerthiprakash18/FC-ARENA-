import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JWT authorization boundary', () => {
  function fixture(status = 'ACTIVE', role = 'PLAYER') {
    process.env.JWT_ACCESS_SECRET = 'test-only-access-secret-not-for-production';
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'user-1', type: 'access', role: 'SUPER_ADMIN' }) };
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ status, role }) } };
    const request = { headers: { authorization: 'Bearer test-token' }, user: undefined };
    const context = { switchToHttp: () => ({ getRequest: () => request }) };
    return { jwt, prisma, request, context, guard: new JwtAuthGuard(jwt as never, prisma as never) };
  }

  it('uses the current database role after an admin is demoted', async () => {
    const f = fixture();
    await expect(f.guard.canActivate(f.context as never)).resolves.toBe(true);
    expect(f.request.user).toMatchObject({ sub: 'user-1', role: 'PLAYER' });
    expect(f.jwt.verifyAsync).toHaveBeenCalledWith('test-token', expect.objectContaining({ algorithms: ['HS256'] }));
  });

  it.each(['SUSPENDED', 'BANNED', 'DELETED'])('rejects a %s account with an otherwise valid JWT', async (status) => {
    const f = fixture(status);
    await expect(f.guard.canActivate(f.context as never)).rejects.toMatchObject({ status: 401 });
    expect(f.request.user).toBeUndefined();
  });

  it('rejects a deleted account', async () => {
    const f = fixture();
    f.prisma.user.findUnique.mockResolvedValue(null as never);
    await expect(f.guard.canActivate(f.context as never)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects refresh tokens at the access-token boundary', async () => {
    const f = fixture();
    f.jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'refresh', role: 'PLAYER' });
    await expect(f.guard.canActivate(f.context as never)).rejects.toMatchObject({ status: 401 });
    expect(f.prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
