import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { Redis } from 'ioredis';
import { boundedRedisOptions } from '../security/redis-options.js';

export const API_RATE_LIMIT_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count < tonumber(ARGV[1]) + 1 then count = redis.call('INCR', KEYS[1]) end
if redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return count
`;

type RateLimitAction =
  | 'SOCIAL_START_IP'
  | 'SOCIAL_EXCHANGE_IP'
  | 'SOCIAL_CALLBACK_IP'
  | 'API_IP'
  | 'API_WRITE_IP'
  | 'VERIFY_EMAIL_IDENTIFIER'
  | 'LOGIN_IP'
  | 'LOGIN_IDENTIFIER'
  | 'REGISTER_IP'
  | 'FORGOT_PASSWORD_IP'
  | 'RESET_PASSWORD_IP'
  | 'RESET_PASSWORD_IDENTIFIER'
  | 'RESEND_VERIFICATION_IP'
  | 'VERIFY_EMAIL_IP'
  | 'REFRESH_IP'
  | 'ACCOUNT_DELETION_REQUEST_IP'
  | 'ACCOUNT_DELETE_USER'
  | 'DAILY_REWARD_CLAIM'
  | 'COIN_COSMETIC_PURCHASE'
  | 'COIN_COSMETIC_EQUIP';

@Injectable()
export class AuthRateLimitService
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthRateLimitService.name);
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private apiRedis: Redis | null = null;
  private redisRetryAt = 0;

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  onModuleInit(): void {
    if (process.env.API_RATE_LIMIT_STORAGE === 'redis') {
      const redis = new Redis(boundedRedisOptions());
      redis.on('error', () => {});
      this.apiRedis = redis;
      void redis.connect().catch(() => { this.redisRetryAt = Date.now() + 10_000; });
    }
    if (process.env.AUTH_RATE_LIMIT_CLEANUP_ENABLED === 'false') {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredBuckets().catch(() => {
        this.logger.warn('Auth rate-limit bucket cleanup failed.');
      });
    }, 6 * 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    this.apiRedis?.disconnect();
    this.apiRedis = null;
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  async consume(
    action: RateLimitAction,
    rawKey: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
    if ((action === 'API_IP' || action === 'API_WRITE_IP') && this.apiRedis && Date.now() >= this.redisRetryAt) {
      let attempts: number | null = null;
      try {
        const value = await this.apiRedis.eval(API_RATE_LIMIT_SCRIPT, 1,
          `fcarena:api-limit:v1:${action}:${this.hashKey(rawKey)}`, limit, windowMs);
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error('Invalid Redis counter');
        attempts = value;
      } catch {
        // Authentication/account budgets always stay in PostgreSQL. If the
        // accelerator fails, global budgets use the existing atomic DB path.
        this.redisRetryAt = Date.now() + 10_000;
      }
      if (attempts !== null) {
        if (attempts > limit) this.rejectLimit();
        return;
      }
    }
    // A single upsert locks the bucket: parallel requests cannot all pass
    // a separate read before incrementing the counter.
    const keyHash = this.hashKey(rawKey);
    const rows = await this.prisma.$queryRaw<Array<{ attemptCount: number }>>`
      INSERT INTO "auth_rate_limits"
        ("action", "keyHash", "windowStartedAt", "attemptCount", "updatedAt")
      VALUES (${action}, ${keyHash}, NOW(), 1, NOW())
      ON CONFLICT ("action", "keyHash") DO UPDATE SET
        "attemptCount" = CASE
          WHEN "auth_rate_limits"."windowStartedAt" <= NOW() - (${windowMs} * INTERVAL '1 millisecond') THEN 1
          ELSE LEAST("auth_rate_limits"."attemptCount" + 1, ${limit + 1}) END,
        "windowStartedAt" = CASE
          WHEN "auth_rate_limits"."windowStartedAt" <= NOW() - (${windowMs} * INTERVAL '1 millisecond') THEN NOW()
          ELSE "auth_rate_limits"."windowStartedAt" END,
        "updatedAt" = NOW()
      RETURNING "attemptCount"
    `;
    if (!rows[0] || rows[0].attemptCount > limit) {
      this.rejectLimit();
    }
  }

  private rejectLimit(): never {
    throw new HttpException({ success: false, data: null,
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
    }, HttpStatus.TOO_MANY_REQUESTS);
  }

  async clear(
    action: RateLimitAction,
    rawKey: string,
  ): Promise<void> {
    const keyHash =
      this.hashKey(rawKey);

    await this.prisma
      .$executeRaw`
        DELETE FROM
          "auth_rate_limits"
        WHERE
          "action" = ${action}
          AND "keyHash" = ${keyHash}
      `;
  }

  async cleanupExpiredBuckets(
    retentionMs = 24 * 60 * 60 * 1000,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - Math.max(retentionMs, 60_000));
    const result = await this.prisma.authRateLimit.deleteMany({
      where: {
        updatedAt: {
          lt: cutoff,
        },
      },
    });

    return result.count;
  }

  private hashKey(
    value: string,
  ): string {
    return createHash(
      'sha256',
    )
      .update(
        value
          .normalize('NFKC')
          .trim()
          .toLowerCase(),
      )
      .digest('hex');
  }
}
