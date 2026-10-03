import { APP_GUARD } from '@nestjs/core';
import { ApiRateLimitGuard } from '../security/api-rate-limit.guard.js';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { OtpMailService } from './mail.service.js';

@Module({
  imports: [
    JwtModule.register({}),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    { provide: APP_GUARD, useClass: ApiRateLimitGuard },
    AuthRateLimitService,
    AuthService,
    JwtAuthGuard,
    OtpMailService,
  ],

  exports: [
    AuthService,
    JwtAuthGuard,
    JwtModule,
  ],
})
export class AuthModule {}