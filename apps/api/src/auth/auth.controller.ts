import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { AuthService } from './auth.service.js';
import { AccountDeletionRequestDto } from './dto/account-deletion-request.dto.js';
import type { AccessTokenPayload } from './auth.types.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { UpdateThemePreferenceDto } from './dto/update-theme-preference.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

const REFRESH_COOKIE_NAME = 'fc_arena_refresh_token';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function clientIp(request: Request): string {
  return (
    request.ip ||
    request.socket
      .remoteAddress ||
    'unknown'
  ).slice(0, 200);
}

function normalizedIdentifier(
  dto: LoginDto,
): string {
  return (
    dto.identifier ??
    dto.email ??
    ''
  )
    .normalize('NFKC')
    .trim()
    .toLowerCase();
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:
      AuthService,
    private readonly rateLimit:
      AuthRateLimitService,
  ) {}

  @Post('register')
  async register(
    @Req() request: Request,
    @Body() dto: RegisterDto,
  ) {
    await this.rateLimit.consume(
      'REGISTER_IP',
      clientIp(request),
      5,
      HOUR_MS,
    );

    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Req() request: Request,
    @Body() dto: VerifyEmailDto,
  ) {
    await this.rateLimit.consume(
      'VERIFY_EMAIL_IP',
      clientIp(request),
      20,
      15 * MINUTE_MS,
    );

    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Req() request: Request,
    @Body() dto: ResendVerificationDto,
  ) {
    await this.rateLimit.consume(
      'RESEND_VERIFICATION_IP',
      clientIp(request),
      10,
      HOUR_MS,
    );

    return this.authService.resendVerification(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() request: Request,
    @Body() dto: LoginDto,
    @Res({ passthrough: true })
    response: Response,
  ) {
    const ip =
      clientIp(request);

    const identifier =
      normalizedIdentifier(
        dto,
      ) || 'empty';

    await this.rateLimit.assertAllowed(
      'LOGIN_IP',
      ip,
      20,
      10 * MINUTE_MS,
    );

    await this.rateLimit.assertAllowed(
      'LOGIN_IDENTIFIER',
      identifier,
      5,
      15 * MINUTE_MS,
    );

    try {
      const result =
        await this.authService.login(
          dto,
        );

      await this.rateLimit.clear(
        'LOGIN_IDENTIFIER',
        identifier,
      );

      this.setRefreshCookie(
        response,
        result.data.refreshToken,
      );

      const {
        refreshToken:
          _refreshToken,
        ...safeData
      } = result.data;

      return {
        ...result,
        data: safeData,
      };
    } catch (error) {
      await Promise.allSettled([
        this.rateLimit.recordAttempt(
          'LOGIN_IP',
          ip,
          10 * MINUTE_MS,
        ),
        this.rateLimit.recordAttempt(
          'LOGIN_IDENTIFIER',
          identifier,
          15 * MINUTE_MS,
        ),
      ]);

      throw error;
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Req() request: Request,
    @Body() dto:
      ForgotPasswordDto,
  ) {
    await this.rateLimit.consume(
      'FORGOT_PASSWORD_IP',
      clientIp(request),
      5,
      HOUR_MS,
    );

    return this.authService
      .forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Req() request: Request,
    @Body() dto:
      ResetPasswordDto,
  ) {
    const ip =
      clientIp(request);

    const identifier =
      dto.email
        .normalize('NFKC')
        .trim()
        .toLowerCase();

    await this.rateLimit.consume(
      'RESET_PASSWORD_IP',
      ip,
      10,
      15 * MINUTE_MS,
    );

    await this.rateLimit.consume(
      'RESET_PASSWORD_IDENTIFIER',
      identifier,
      10,
      15 * MINUTE_MS,
    );

    return this.authService
      .resetPassword(dto);
  }

  @Post('account-deletion-request')
  @HttpCode(HttpStatus.OK)
  async requestAccountDeletion(
    @Req() request: Request,
    @Body() dto:
      AccountDeletionRequestDto,
  ) {
    await this.rateLimit.consume(
      'ACCOUNT_DELETION_REQUEST_IP',
      clientIp(request),
      3,
      HOUR_MS,
    );

    return this.authService
      .requestAccountDeletion(
        dto,
      );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.rateLimit.consume(
      'REFRESH_IP',
      clientIp(request),
      120,
      10 * MINUTE_MS,
    );

    const refreshToken = request.cookies?.[
      REFRESH_COOKIE_NAME
    ] as string | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh session is required.',
        },
      });
    }

    const result = await this.authService.refresh(refreshToken);

    this.setRefreshCookie(response, result.data.refreshToken);

    const { refreshToken: _refreshToken, ...safeData } = result.data;

    return {
      ...result,
      data: safeData,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[
      REFRESH_COOKIE_NAME
    ] as string | undefined;

    const result = await this.authService.logout(refreshToken);

    const isProduction = process.env.NODE_ENV === 'production';

    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite:
        isProduction
          ? 'strict'
          : 'lax',
      path: '/api/auth',
    });

    return result;
  }

  @Post('accept-terms')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async acceptTerms(
    @Req()
    request: Request & {
      user: AccessTokenPayload;
    },
  ) {
    return this.authService.acceptTerms(
      request.user.sub,
    );
  }

  @Patch('preferences/theme')
  @UseGuards(JwtAuthGuard)
  async updateThemePreference(
    @Req()
    request: Request & {
      user: AccessTokenPayload;
    },
    @Body() dto: UpdateThemePreferenceDto,
  ) {
    return this.authService.updateThemePreference(
      request.user.sub,
      dto.themePreference,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @Req()
    request: Request & {
      user: AccessTokenPayload;
    },
  ) {
    return this.authService.getMe(request.user.sub);
  }

  private setRefreshCookie(response: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite:
        isProduction
          ? 'strict'
          : 'lax',
      path: '/api/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }
}