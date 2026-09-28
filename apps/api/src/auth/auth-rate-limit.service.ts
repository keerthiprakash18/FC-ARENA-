import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';

type RateLimitAction =
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

  async assertAllowed(
    action: RateLimitAction,
    rawKey: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
    const keyHash =
      this.hashKey(rawKey);

    const rows =
      await this.prisma.$queryRaw<
        Array<{
          attemptCount: number;
          windowStartedAt: Date;
        }>
      >`
        SELECT
          "attemptCount",
          "windowStartedAt"
        FROM "auth_rate_limits"
        WHERE
          "action" = ${action}
          AND "keyHash" = ${keyHash}
        LIMIT 1
      `;

    const row =
      rows[0];

    if (!row) {
      return;
    }

    const expired =
      row.windowStartedAt
        .getTime() <=
      Date.now() -
        windowMs;

    if (expired) {
      await this.clear(
        action,
        rawKey,
      );

      return;
    }

    if (
      row.attemptCount >=
      limit
    ) {
      throw new HttpException(
        {
          success: false,
          data: null,
          error: {
            code:
              'RATE_LIMITED',
            message:
              'Too many attempts. Please try again later.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordAttempt(
    action: RateLimitAction,
    rawKey: string,
    windowMs: number,
  ): Promise<void> {
    const keyHash =
      this.hashKey(rawKey);

    const cutoff =
      new Date(
        Date.now() -
          windowMs,
      );

    await this.prisma
      .$executeRaw`
        DELETE FROM
          "auth_rate_limits"
        WHERE
          "action" = ${action}
          AND "keyHash" = ${keyHash}
          AND "windowStartedAt" <=
            ${cutoff}
      `;

    await this.prisma
      .$executeRaw`
        INSERT INTO
          "auth_rate_limits" (
            "action",
            "keyHash",
            "windowStartedAt",
            "attemptCount",
            "updatedAt"
          )
        VALUES (
          ${action},
          ${keyHash},
          NOW(),
          1,
          NOW()
        )
        ON CONFLICT (
          "action",
          "keyHash"
        )
        DO UPDATE SET
          "attemptCount" =
            "auth_rate_limits"."attemptCount" + 1,
          "updatedAt" =
            NOW()
      `;
  }

  async consume(
    action: RateLimitAction,
    rawKey: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
    await this.assertAllowed(
      action,
      rawKey,
      limit,
      windowMs,
    );

    await this.recordAttempt(
      action,
      rawKey,
      windowMs,
    );
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
