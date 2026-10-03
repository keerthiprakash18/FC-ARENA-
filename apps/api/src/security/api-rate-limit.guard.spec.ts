import { describe, expect, it, vi } from 'vitest';
import { ApiRateLimitGuard } from './api-rate-limit.guard.js';

describe('Global API limiter', () => {
  function context(method: string, path: string) {
    return { switchToHttp: () => ({ getRequest: () => ({ method, path, ip: '127.0.0.1' }) }) } as never;
  }
  it('keeps health probes available without database access', async () => {
    const consume = vi.fn();
    await expect(new ApiRateLimitGuard({ consume } as never).canActivate(context('GET', '/api/health'))).resolves.toBe(true);
    expect(consume).not.toHaveBeenCalled();
  });
  it('applies both read and write budgets to destructive requests', async () => {
    const consume = vi.fn().mockResolvedValue(undefined);
    await new ApiRateLimitGuard({ consume } as never).canActivate(context('DELETE', '/api/leagues/123'));
    expect(consume).toHaveBeenCalledWith('API_IP', '127.0.0.1', 1200, 60_000);
    expect(consume).toHaveBeenCalledWith('API_WRITE_IP', '127.0.0.1', 300, 60_000);
  });
  it('rejects over-quota requests', async () => {
    const consume = vi.fn().mockRejectedValue(new Error('limited'));
    await expect(new ApiRateLimitGuard({ consume } as never).canActivate(context('GET', '/api/leagues'))).rejects.toThrow('limited');
  });
});
