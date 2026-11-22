import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { execFileSync } from 'node:child_process';
import { readFile,stat } from 'node:fs/promises';
import { assessBackupHealth } from './backup-health.js';

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

const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/i;

function resolveReleaseSha(): string | undefined {
  const configured = process.env.FC_ARENA_RELEASE_SHA?.trim();

  if (configured && RELEASE_SHA_PATTERN.test(configured)) {
    return configured;
  }

  if (process.env.NODE_ENV !== 'production') {
    return undefined;
  }

  try {
    const checkoutSha = execFileSync(
      'git',
      ['rev-parse', 'HEAD'],
      {
        encoding: 'utf8',
        timeout: 250,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();

    return RELEASE_SHA_PATTERN.test(checkoutSha)
      ? checkoutSha
      : undefined;
  } catch {
    return undefined;
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  @Get('backups')
  async backups() {
    const file=process.env.BACKUP_HEALTH_FILE;
    if(!file)return {success:true,data:{configured:false},error:null};
    try {
      if((await stat(file)).size>16384)throw Error('Invalid backup state');
      const data=assessBackupHealth(JSON.parse(await readFile(file,'utf8')));
      if(data.status!=='healthy')throw Error('Backup recovery is stale');
      return {success:true,data,error:null};
    } catch {
      throw new ServiceUnavailableException({success:false,data:null,error:{code:'BACKUP_RECOVERY_UNAVAILABLE',message:'Backup or off-host recovery verification needs attention.'}});
    }
  }

  @Get('live')
  liveness() {
    return {
      success: true,
      data: {
        status: 'alive',
        timestamp: new Date().toISOString(),
      },
      error: null,
    };
  }

  @Get('ready')
  checkReadiness() {
    return this.checkHealth();
  }

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

    const release = resolveReleaseSha();

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
        backupMonitoring: process.env.BACKUP_HEALTH_FILE ? 'enabled' : 'disabled',
        ...(release
          ? {
              runtime: {
                release,
                instance: process.env.FC_ARENA_INSTANCE_ID ?? 'primary',
              },
            }
          : {}),
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

}
