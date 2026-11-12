import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Daily, anonymous aggregates only. This service intentionally NEVER stores
 * a URL, IP address, player ID, request header, query, path, cookie or token.
 * The histograms persist across API restarts and aggregate across instances.
 */
const RETENTION_SECONDS = 15 * 24 * 60 * 60;
const FLUSH_MS = 30_000;
const MAX_PENDING_KEYS = 1_024;
export const DURATION_BUCKETS_MS = [
  10, 25, 50, 100, 250, 500, 1_000, 2_000, 5_000, 10_000, 30_000, 120_000,
] as const;
export const CLS_BUCKETS = [
  0.01, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 1, 2, 4, 10,
] as const;

export type MetricName = 'API_MS' | 'CLS' | 'FCP' | 'INP' | 'LCP' | 'TTFB' | 'API_5XX';
export const METRICS: readonly MetricName[] = [
  'API_MS', 'CLS', 'FCP', 'INP', 'LCP', 'TTFB', 'API_5XX',
];
const KEY_PREFIX = 'fc-arena:telemetry:v1';

function bounds(metric: MetricName): readonly number[] {
  return metric === 'CLS' ? CLS_BUCKETS : DURATION_BUCKETS_MS;
}

export function bucketIndex(metric: MetricName, value: number): number {
  return bounds(metric).findIndex(limit => value <= limit) === -1
    ? bounds(metric).length
    : bounds(metric).findIndex(limit => value <= limit);
}

export function approximatePercentile(
  metric: MetricName,
  histogram: number[],
  quantile: number,
): number | null {
  const sum = histogram.reduce((total, value) => total + Math.max(0, value), 0);
  if (sum === 0) return null;
  const goal = Math.max(1, Math.ceil(sum * quantile));
  let accumulated = 0;
  for (let index = 0; index < histogram.length; index++) {
    accumulated += Math.max(0, histogram[index] ?? 0);
    if (accumulated >= goal) {
      return bounds(metric)[index] ?? bounds(metric).at(-1) ?? null;
    }
  }
  return null;
}

function redisOptions() {
  return {
    lazyConnect: true,
    connectTimeout: 1_500,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
  };
}

@Injectable()
export class DurableTelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DurableTelemetryService.name);
  private redis: Redis | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending = new Map<string, number>();
  private flushing = false;
  private dropped = 0;

  async onModuleInit() {
    if (process.env.TELEMETRY_DURABLE_ENABLED !== 'true') return;
    const url = process.env.REDIS_URL?.trim();
    const host = process.env.REDIS_HOST?.trim();
    if (!url && !host) {
      this.logger.warn('Durable telemetry is opt-in but Redis is not configured.');
      return;
    }
    const redis = url
      ? new Redis(url, redisOptions())
      : new Redis({
          ...redisOptions(),
          host,
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASSWORD || undefined,
          tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
        });
    redis.on('error', () => { /* health is reported by the existing Redis check */ });
    try {
      await redis.connect();
      this.redis = redis;
      this.timer = setInterval(() => {
        void this.flush();
      }, FLUSH_MS);
      this.timer.unref();
    } catch {
      redis.disconnect();
      this.logger.warn('Durable telemetry Redis connection unavailable; API remains operational.');
    }
  }

  record(metric: MetricName, value: number, date = new Date()) {
    if (!this.redis || !Number.isFinite(value) || value < 0 || value > 120_000 ||
        Number.isNaN(date.getTime()) || !METRICS.includes(metric)) return;
    const key = `${KEY_PREFIX}:${date.toISOString().slice(0, 10)}:${metric}`;
    const index = metric === 'API_5XX' ? 0 : bucketIndex(metric, value);
    const pendingKey = `${key}|b${index}`;
    if (!this.pending.has(pendingKey) && this.pending.size >= MAX_PENDING_KEYS) {
      this.dropped++;
      return;
    }
    this.pending.set(pendingKey, (this.pending.get(pendingKey) ?? 0) + 1);
    if (this.pending.size >= 256) void this.flush();
  }

  recordApiFailure() {
    this.record('API_5XX', 1);
  }

  async flush() {
    if (!this.redis || this.flushing || this.pending.size === 0) return;
    const current = this.pending;
    this.pending = new Map();
    this.flushing = true;
    const redis = this.redis;
    try {
      const pipeline = redis.pipeline();
      const touchedKeys = new Set<string>();
      for (const [combined, count] of current) {
        const separator = combined.lastIndexOf('|');
        const key = combined.slice(0, separator);
        const field = combined.slice(separator + 1);
        pipeline.hincrby(key, field, count);
        touchedKeys.add(key);
      }
      for (const key of touchedKeys) pipeline.expire(key, RETENTION_SECONDS);
      const results = await pipeline.exec();
      if (!results || results.some(([error]) => error)) {
        throw new Error('Redis telemetry pipeline failed');
      }
    } catch {
      for (const [key, count] of current) {
        if (this.pending.has(key) || this.pending.size < MAX_PENDING_KEYS) {
          this.pending.set(key, (this.pending.get(key) ?? 0) + count);
        } else this.dropped += count;
      }
      this.logger.warn('Telemetry flush failed; buffered samples retained up to memory limit.');
    } finally {
      this.flushing = false;
    }
  }

  async recentDays(days = 7) {
    const count = Math.min(14, Math.max(1, Math.trunc(days)));
    if (!this.redis) return {
      enabled: false,
      source: 'not_configured',
      retentionDays: 15,
      droppedSamples: this.dropped,
      days: [],
    };
    await this.flush();
    const result = [];
    for (let offset = count - 1; offset >= 0; offset--) {
      const day = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
      const metrics: Record<string, unknown> = {};
      for (const metric of METRICS) {
        const values = await this.redis.hgetall(`${KEY_PREFIX}:${day}:${metric}`);
        const histogram = Array.from({ length: bounds(metric).length + 1 }, (_, i) =>
          Number(values[`b${i}`] ?? 0),
        );
        const samples = histogram.reduce((sum, amount) => sum + amount, 0);
        metrics[metric] = metric === 'API_5XX'
          ? { events: samples }
          : {
              samples,
              p75UpperBound: approximatePercentile(metric, histogram, 0.75),
              p95UpperBound: approximatePercentile(metric, histogram, 0.95),
              unit: metric === 'CLS' ? 'score' : 'ms',
            };
      }
      result.push({ day, metrics });
    }
    return {
      enabled: true,
      source: 'redis-daily-anonymous-histograms',
      retentionDays: 15,
      percentileType: 'bucket-upper-bound-approximation',
      droppedSamples: this.dropped,
      days: result,
    };
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
    this.redis?.disconnect();
    this.redis = null;
  }
}
