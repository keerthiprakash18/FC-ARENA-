import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';

describe('public health output', () => {
  it('keeps liveness free of runtime and telemetry details', () => {
    const controller = new HealthController({} as never);

    expect(controller.liveness()).toEqual({
      success: true,
      data: {
        status: 'alive',
        timestamp: expect.any(String),
      },
      error: null,
    });
  });

  it('keeps readiness checks while omitting runtime details', async () => {
    const controller = new HealthController({
      $queryRaw: vi.fn().mockResolvedValue([{ value: 1 }]),
    } as never);

    const previousRedisUrl = process.env.REDIS_URL;
    const previousRedisHost = process.env.REDIS_HOST;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;

    try {
      const response = await controller.checkHealth();

      expect(response.data).not.toHaveProperty('runtime');
      expect(response.data).not.toHaveProperty('telemetry');
      expect(response.data.checks.database.status).toBe('connected');
    } finally {
      if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previousRedisUrl;
      if (previousRedisHost === undefined) delete process.env.REDIS_HOST;
      else process.env.REDIS_HOST = previousRedisHost;
    }
  });

  it('exposes only the configured release SHA when provided', async () => {
    const controller = new HealthController({
      $queryRaw: vi.fn().mockResolvedValue([{ value: 1 }]),
    } as never);

    const previousRedisUrl = process.env.REDIS_URL;
    const previousRedisHost = process.env.REDIS_HOST;
    const previousRelease = process.env.FC_ARENA_RELEASE_SHA;
    process.env.FC_ARENA_RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567';
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;

    try {
      const response = await controller.checkHealth();

      expect(response.data.runtime).toEqual({
        release: '0123456789abcdef0123456789abcdef01234567',
      });
      expect(response.data).not.toHaveProperty('telemetry');
    } finally {
      if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previousRedisUrl;
      if (previousRedisHost === undefined) delete process.env.REDIS_HOST;
      else process.env.REDIS_HOST = previousRedisHost;
      if (previousRelease === undefined) delete process.env.FC_ARENA_RELEASE_SHA;
      else process.env.FC_ARENA_RELEASE_SHA = previousRelease;
    }
  });
});
