import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  JwtService,
} from '@nestjs/jwt';

import type {
  Request,
} from 'express';

import {
  PrismaService,
} from '../../database/prisma.service.js';

import type {
  AccessTokenPayload,
} from '../auth.types.js';

@Injectable()
export class JwtAuthGuard
  implements
    CanActivate {
  private readonly accessSecret:
    string;

  constructor(
    private readonly jwtService:
      JwtService,

    private readonly prisma:
      PrismaService,
  ) {
    const secret =
      process.env
        .JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error(
        'JWT_ACCESS_SECRET is missing.',
      );
    }

    this.accessSecret =
      secret;
  }

  async canActivate(
    context:
      ExecutionContext,
  ): Promise<boolean> {
    const request =
      context
        .switchToHttp()
        .getRequest<
          Request & {
            user?:
              AccessTokenPayload;
          }
        >();

    const authorization =
      request.headers
        .authorization;

    if (
      !authorization
        ?.startsWith(
          'Bearer ',
        )
    ) {
      throw this.unauthorized(
        'AUTH_TOKEN_REQUIRED',
        'Access token is required.',
      );
    }

    const token =
      authorization.slice(
        7,
      );

    try {
      const payload =
        await this.jwtService
          .verifyAsync<
            AccessTokenPayload
          >(
            token,
            {
              secret:
                this.accessSecret,
            },
          );

      if (
        payload.type !==
          'access' ||
        !payload.sid
      ) {
        throw new Error(
          'Invalid token type or session.',
        );
      }

      const activeSession =
        await this.prisma
          .refreshSession
          .findFirst({
            where: {
              id:
                payload.sid,

              userId:
                payload.sub,

              revokedAt:
                null,

              expiresAt: {
                gt:
                  new Date(),
              },

              user: {
                status:
                  'ACTIVE',
              },
            },

            select: {
              id: true,
            },
          });

      if (
        !activeSession
      ) {
        throw new Error(
          'Session is revoked, expired or account is inactive.',
        );
      }

      request.user =
        payload;

      return true;
    } catch {
      throw this.unauthorized(
        'AUTH_TOKEN_INVALID',
        'Access token is invalid, expired, revoked or belongs to an inactive account.',
      );
    }
  }

  private unauthorized(
    code: string,
    message: string,
  ) {
    return new UnauthorizedException({
      success: false,
      data: null,
      error: {
        code,
        message,
      },
    });
  }
}
