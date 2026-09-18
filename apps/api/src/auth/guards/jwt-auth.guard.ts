import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessSecret: string;

  constructor(private readonly jwtService: JwtService) {
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

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.accessSecret,
        },
      );

      if (payload.type !== 'access') {
        throw new Error('Invalid token type.');
      }

      request.user = payload;
      return true;
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
  }
}