import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import type { AccessTokenPayload } from '../auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessSecret: string;

  constructor(private readonly jwtService: JwtService, private readonly prisma: PrismaService) {
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is missing.');
    }

    this.accessSecret = secret;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: AccessTokenPayload }
    >();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code: 'AUTH_TOKEN_REQUIRED',
          message: 'Access token is required.',
        },
      });
    }

    const token = authorization.slice(7);

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.accessSecret,
          algorithms: ['HS256'],
        },
      );

      if (payload.type !== 'access' || typeof payload.sub !== 'string' || !payload.sub) {
        throw new Error('Invalid token type.');
      }

    } catch {
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Access token is invalid or expired.',
        },
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, role: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ success: false, data: null, error: { code: 'AUTH_TOKEN_INVALID', message: 'Access token is invalid or expired.' } });
    }
    // Session-bound access tokens must stop working after logout, rotation or
    // password reset. Legacy tokens without a sid retain their short expiry.
    if (payload.sid !== undefined) {
      if (typeof payload.sid !== 'string' || !payload.sid) {
        throw new UnauthorizedException({ success: false, data: null, error: { code: 'AUTH_TOKEN_INVALID', message: 'Access token is invalid or expired.' } });
      }
      const session = await this.prisma.refreshSession.findUnique({
        where: { id: payload.sid },
        select: { userId: true, revokedAt: true, expiresAt: true },
      });
      if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException({ success: false, data: null, error: { code: 'AUTH_TOKEN_INVALID', message: 'Access token is invalid or expired.' } });
      }
    }
    // Do not keep a removed admin role alive until JWT expiry.
    request.user = { ...payload, role: user.role };
    return true;
  }
}