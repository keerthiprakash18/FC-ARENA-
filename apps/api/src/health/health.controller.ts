import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Redis } from 'ioredis';

import {
  PrismaService,
} from '../database/prisma.service.js';

type RedisHealth = {
  configured: boolean;
  status:
    | 'connected'
    | 'not_configured';
  latencyMs: number | null;
};

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  @Get()
  async checkHealth() {
    const checkedAt =
      new Date();

    const databaseStarted =
      performance.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        success: false,
        data: {
          application:
            'FC ARENA API',
          api: 'connected',
          database:
            'unavailable',
          redis:
            'unknown',
          status:
            'unhealthy',
          timestamp:
            checkedAt.toISOString(),
        },
        error: {
          code:
            'DATABASE_UNAVAILABLE',
          message:
            'Database health check failed.',
        },
      });
    }

    const databaseLatencyMs =
      Number(
        (
          performance.now() -
          databaseStarted
        ).toFixed(1),
      );

    let redis:
      RedisHealth;

    try {
      redis =
        await this.checkRedis();
    } catch {
      throw new ServiceUnavailableException({
        success: false,
        data: {
          application:
            'FC ARENA API',
          api: 'connected',
          database:
            'connected',
          redis:
            'unavailable',
          status:
            'unhealthy',
          timestamp:
            checkedAt.toISOString(),
        },
        error: {
          code:
            'REDIS_UNAVAILABLE',
          message:
            'Redis health check failed.',
        },
      });
    }

    const memory =
      process.memoryUsage();

    return {
      success: true,
      data: {
        application:
          'FC ARENA API',
        api: 'connected',
        database:
          'connected',
        redis:
          redis.status,
        status:
          databaseLatencyMs <=
            1_000
            ? 'healthy'
            : 'degraded',
        timestamp:
          checkedAt.toISOString(),
        checks: {
          database: {
            status:
              'connected',
            latencyMs:
              databaseLatencyMs,
          },
          redis,
        },
        runtime: {
          node:
            process.version,
          uptimeSeconds:
            Math.floor(
              process.uptime(),
            ),
          memory: {
            rssMb:
              this.toMb(
                memory.rss,
              ),
            heapUsedMb:
              this.toMb(
                memory.heapUsed,
              ),
            heapTotalMb:
              this.toMb(
                memory.heapTotal,
              ),
          },
          release:
            process.env
              .FC_ARENA_RELEASE_SHA ??
            null,
        },
      },
      error: null,
    };
  }

  private async checkRedis():
    Promise<RedisHealth> {
    const redisUrl =
      process.env.REDIS_URL
        ?.trim();

    const redisHost =
      process.env.REDIS_HOST
        ?.trim();

    if (
      !redisUrl &&
      !redisHost
    ) {
      return {
        configured: false,
        status:
          'not_configured',
        latencyMs: null,
      };
    }

    const commonOptions = {
      lazyConnect: true,
      connectTimeout: 1_500,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
    };

    const redis =
      redisUrl
        ? new Redis(
            redisUrl,
            commonOptions,
          )
        : new Redis({
            ...commonOptions,
            host:
              redisHost,
            port:
              Number(
                process.env
                  .REDIS_PORT ??
                  6379,
              ),
            password:
              process.env
                .REDIS_PASSWORD ||
              undefined,
            tls:
              process.env
                .REDIS_TLS ===
              'true'
                ? {}
                : undefined,
          });

    const started =
      performance.now();

    try {
      await this.withTimeout(
        redis.connect(),
        2_000,
      );

      const pong =
        await this.withTimeout(
          redis.ping(),
          2_000,
        );

      if (
        pong !==
        'PONG'
      ) {
        throw new Error(
          'Unexpected Redis PING response.',
        );
      }

      return {
        configured: true,
        status:
          'connected',
        latencyMs:
          Number(
            (
              performance.now() -
              started
            ).toFixed(
              1,
            ),
          ),
      };
    } finally {
      redis.disconnect();
    }
  }

  private async withTimeout<T>(
    operation:
      Promise<T>,
    timeoutMs:
      number,
  ): Promise<T> {
    let timer:
      NodeJS.Timeout |
      undefined;

    try {
      return await Promise.race([
        operation,
        new Promise<never>(
          (
            _resolve,
            reject,
          ) => {
            timer =
              setTimeout(
                () =>
                  reject(
                    new Error(
                      'Health check timed out.',
                    ),
                  ),
                timeoutMs,
              );
          },
        ),
      ]);
    } finally {
      if (
        timer
      ) {
        clearTimeout(
          timer,
        );
      }
    }
  }

  private toMb(
    bytes: number,
  ): number {
    return Number(
      (
        bytes /
        1024 /
        1024
      ).toFixed(
        1,
      ),
    );
  }
}
