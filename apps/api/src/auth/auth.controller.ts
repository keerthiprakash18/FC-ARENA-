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
import { AuthService } from './auth.service.js';
import type { AccessTokenPayload } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { UpdateThemePreferenceDto } from './dto/update-theme-preference.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

const REFRESH_COOKIE_NAME = 'fc_arena_refresh_token';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);

    this.setRefreshCookie(response, result.data.refreshToken);

    const { refreshToken: _refreshToken, ...safeData } = result.data;

    return {
      ...result,
      data: safeData,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
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
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api/auth',
    });

    return result;
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
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }
}