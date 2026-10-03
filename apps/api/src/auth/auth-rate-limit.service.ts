import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';

type RateLimitAction =
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
  | 'ACCOUNT_DELETION_REQUEST_IP';

@Injectable()
export class AuthRateLimitService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async consume(
    action: RateLimitAction,
    rawKey: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
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
      throw new HttpException({
        success: false, data: null,
        error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
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
