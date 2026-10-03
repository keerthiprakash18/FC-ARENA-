import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service.js';

@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: AuthRateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    // Health probes must continue to work when storage is unavailable.
    if (request.method === 'OPTIONS' || /^\/api\/health(?:\/|$)/.test(request.path)) return true;
    const ip = (request.ip || request.socket.remoteAddress || 'unknown').slice(0, 200);
    // Shared NATs and dashboard polling need a generous global ceiling.
    // Auth endpoints retain their much tighter per-action/account limits.
    await this.rateLimit.consume('API_IP', ip, 1200, 60_000);
    if (!['GET', 'HEAD'].includes(request.method)) {
      await this.rateLimit.consume('API_WRITE_IP', ip, 300, 60_000);
    }
    return true;
  }
}
