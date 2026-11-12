import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { DurableTelemetryService, approximatePercentile, bucketIndex } from './durable-telemetry.service.js';
import { TelemetryService } from './telemetry.service.js';
import { AdminOpsService } from '../admin-ops/admin-ops.service.js';

type TestRedis = {
  pipeline: ReturnType<typeof vi.fn>;
  hgetall: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function setup() {
  const calls: Array<{ kind: string; args: unknown[] }> = [];
  const pipeline = {
    hincrby: vi.fn((...args: unknown[]) => { calls.push({ kind: 'increment', args }); return pipeline; }),
    expire: vi.fn((...args: unknown[]) => { calls.push({ kind: 'expire', args }); return pipeline; }),
    exec: vi.fn(async () => calls.map(() => [null, 1])),
  };
  const redis = {
    pipeline: vi.fn(() => pipeline),
    hgetall: vi.fn(async () => ({})),
    disconnect: vi.fn(),
  };
  const service = new DurableTelemetryService();
  (service as unknown as { redis: TestRedis }).redis = redis;
  return { service, redis, pipeline, calls };
}

describe('anonymous durable telemetry aggregates', () => {
  it('uses stable millisecond and fractional CLS bucket upper bounds', () => {
    expect(bucketIndex('API_MS', 250)).toBe(4);
    expect(bucketIndex('CLS', 0.08)).toBe(3);
    expect(approximatePercentile('CLS', [0, 1, 2, 7], 0.95)).toBe(0.1);
    expect(approximatePercentile('API_MS', [], 0.95)).toBeNull();
  });

  it('counts only permitted aggregate keys without identity or path data', async () => {
    const { service, calls, pipeline } = setup();
    const date = new Date('2026-11-12T04:00:00.000Z');
    service.record('API_MS', 250, date);
    service.record('API_MS', 250, date);
    service.record('CLS', 0.08, date);
    service.record('API_MS', -1, date);
    service.record('API_MS', Number.NaN, date);
    await service.flush();
    expect(pipeline.exec).toHaveBeenCalledOnce();
    expect(calls.find(x => x.kind === 'increment' &&
      (x.args[0] as string).endsWith(':API_MS'))?.args)
      .toEqual(['fc-arena:telemetry:v1:2026-11-12:API_MS', 'b4', 2]);
    expect(calls.every(x => String(x.args[0]).startsWith('fc-arena:telemetry:v1:'))).toBe(true);
    expect(calls.find(x => x.kind === 'increment' && String(x.args[0]).endsWith(':CLS'))?.args)
      .toEqual(['fc-arena:telemetry:v1:2026-11-12:CLS', 'b3', 1]);
  });

  it('retains pending metrics when Redis write fails rather than losing them silently', async () => {
    const { service, pipeline } = setup();
    service.record('API_MS', 125, new Date('2026-11-12T05:00:00.000Z'));
    pipeline.exec.mockRejectedValueOnce(new Error('offline'));
    await service.flush();
    expect((service as unknown as { pending: Map<string, number> }).pending.size).toBe(1);
  });

  it('returns a bounded anonymous seven-day view and 5xx counts', async () => {
    const { service, redis } = setup();
    redis.hgetall.mockImplementation(async (key: string) => {
      if (key.endsWith(':API_5XX')) return { b0: '3' };
      if (key.endsWith(':API_MS')) return { b0: '1', b4: '3' };
      return {};
    });
    const view = await service.recentDays(7);
    expect(view).toMatchObject({
      enabled: true, source: 'redis-daily-anonymous-histograms',
      percentileType: 'bucket-upper-bound-approximation',
    });
    expect(view.days).toHaveLength(7);
    expect(view.days[0].metrics.API_5XX).toEqual({ events: 3 });
    expect(view.days[0].metrics.API_MS).toMatchObject({
      samples: 4, p95UpperBound: 250,
    });
  });

  it('keeps existing instance-only snapshots compatible with optional persistence', () => {
    const service = new TelemetryService();
    service.recordApiLatency(30);
    expect(service.snapshot().api).toMatchObject({ samples: 1, p95: 30 });
  });

  it('forbids non-super-admin reads before querying metrics', async () => {
    const durable = { recentDays: vi.fn() };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ role: 'PLAYER' }) },
    };
    const service = new AdminOpsService(prisma as never, durable as never);
    await expect(service.telemetryHistory('player-id')).rejects.toBeInstanceOf(ForbiddenException);
    expect(durable.recentDays).not.toHaveBeenCalled();
  });
});
