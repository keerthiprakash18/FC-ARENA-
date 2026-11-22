import type { RedisOptions } from 'ioredis';

/** Bounded connections shared by optional Redis acceleration and pub/sub. */
export function boundedRedisOptions(): RedisOptions {
  const raw = process.env.REDIS_URL?.trim();
  const url = raw ? new URL(raw) : null;
  if (url && !['redis:', 'rediss:'].includes(url.protocol)) throw new Error('Unsupported Redis protocol.');
  return {
    host: url?.hostname ?? process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(url?.port || process.env.REDIS_PORT || 6379),
    username: url?.username ? decodeURIComponent(url.username) : process.env.REDIS_USERNAME || undefined,
    password: url?.password ? decodeURIComponent(url.password) : process.env.REDIS_PASSWORD || undefined,
    db: url?.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
    tls: url?.protocol === 'rediss:' || process.env.REDIS_TLS === 'true' ? {} : undefined,
    lazyConnect: true, connectTimeout: 1000, commandTimeout: 1000,
    enableOfflineQueue: false, maxRetriesPerRequest: 0,
    retryStrategy: attempts => Math.min(5000, 250 * attempts),
  };
}
