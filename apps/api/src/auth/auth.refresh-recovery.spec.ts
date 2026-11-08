import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('Refresh-session failure recovery', () => {
  afterEach(() => vi.unstubAllEnvs());
  const run = async (error: unknown) => {
    const clearCookie = vi.fn(), cookie = vi.fn();
    const controller = new AuthController({ refresh: vi.fn().mockRejectedValue(error) } as never,
      { consume: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(controller.refresh({ cookies: { fc_arena_refresh_token: 'valid-session' },
      ip: '127.0.0.1' } as never, { clearCookie, cookie } as never)).rejects.toBe(error);
    expect(cookie).not.toHaveBeenCalled(); return clearCookie;
  };
  it.each([new ServiceUnavailableException('Temporary outage'), new Error('Database unavailable')])('preserves the session during a transient failure', async error => {
    expect(await run(error)).not.toHaveBeenCalled();
  });
  it('clears an explicitly invalid, expired or revoked session', async () => {
    expect(await run(new UnauthorizedException())).toHaveBeenCalledWith('fc_arena_refresh_token',
      expect.objectContaining({ httpOnly: true, path: '/api/auth' }));
  });
  it('does not consume a refresh token before all profile reads succeed', async () => {
    vi.stubEnv('JWT_ACCESS_SECRET', 'refresh-recovery-access-secret');
    vi.stubEnv('JWT_REFRESH_SECRET', 'refresh-recovery-refresh-secret');
    const failure = new Error('Profile read temporarily unavailable');
    const prisma = { refreshSession: { findUnique: vi.fn().mockResolvedValue({
      id: 'session', userId: 'user', revokedAt: null, expiresAt: new Date(Date.now() + 60000),
      tokenHash: createHash('sha256').update('token').digest('hex'), user: { id: 'user', email: 'fixture@example.invalid',
        status: 'ACTIVE', role: 'USER', passwordHash: 'fixture', player: null },
    }) }, $queryRaw: vi.fn().mockRejectedValue(failure), $transaction: vi.fn() };
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'user', sid: 'session', type: 'refresh' }),
      signAsync: vi.fn().mockResolvedValue('new-token') };
    const service = new AuthService(prisma as never, jwt as never, {} as never);
    await expect(service.refresh('token')).rejects.toBe(failure);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
