import { APP_GUARD } from '@nestjs/core';
import { ApiRateLimitGuard } from '../security/api-rate-limit.guard.js';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { OtpMailService } from './mail.service.js';
import { DateOfBirthService } from './date-of-birth.service.js';
import { DateOfBirthController } from './date-of-birth.controller.js';
import {SocialAuthController} from './social-auth.controller.js';
import {SocialAuthService} from './social-auth.service.js';
import {SocialProviderService} from './social-provider.service.js';
import {SocialStateStore} from './social-state.store.js';

@Module({
  imports: [
    JwtModule.register({}),
  ],

  controllers: [
    SocialAuthController,
    DateOfBirthController,
    AuthController,
  ],

  providers: [
    SocialAuthService,SocialProviderService,SocialStateStore,
    DateOfBirthService,
    { provide: APP_GUARD, useClass: ApiRateLimitGuard },
    AuthRateLimitService,
    AuthService,
    JwtAuthGuard,
    OtpMailService,
  ],

  exports: [
    AuthRateLimitService,
    AuthService,
    JwtAuthGuard,
    JwtModule,
  ],
})
export class AuthModule {}
