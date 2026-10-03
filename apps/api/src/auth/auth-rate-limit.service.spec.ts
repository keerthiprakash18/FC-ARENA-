import { describe, expect, it, vi } from 'vitest';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { AuthController } from './auth.controller.js';

describe('Auth rate-limit enforcement', () => {
  it('allows the last available attempt and rejects the first over quota', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValueOnce([{ attemptCount: 5 }]).mockResolvedValueOnce([{ attemptCount: 6 }]) };
    const limiter = new AuthRateLimitService(prisma as never);
    await expect(limiter.consume('LOGIN_IP', '127.0.0.1', 5, 60000)).resolves.toBeUndefined();
    await expect(limiter.consume('LOGIN_IP', '127.0.0.1', 5, 60000)).rejects.toMatchObject({ status: 429 });
  });

  it('fails closed when the rate-limit database is unavailable', async () => {
    const limiter = new AuthRateLimitService({ $queryRaw: vi.fn().mockRejectedValue(new Error('unavailable')) } as never);
    await expect(limiter.consume('LOGIN_IP', '127.0.0.1', 5, 60000)).rejects.toThrow('unavailable');
  });

  it('never attempts password verification when the IP or identifier is limited', async () => {
    for (const blockedCall of [1, 2]) {
      let calls = 0;
      const auth = { login: vi.fn() };
      const rateLimit = { consume: vi.fn(async () => { if (++calls === blockedCall) throw new Error('limited'); }) };
      const controller = new AuthController(auth as never, rateLimit as never);
      await expect(controller.login({ ip: '127.0.0.1' } as never, { identifier: 'player', password: 'test-password' }, {} as never)).rejects.toThrow('limited');
      expect(auth.login).not.toHaveBeenCalled();
    }
  });
});
