import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SocialAuthService } from './social-auth.service.js';
import {
  SocialProviderService,
  providerName,
} from './social-provider.service.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { setAuthRefreshCookie } from './auth-cookies.js';
import {
  ConnectSocialDto,
  ExchangeSocialDto,
  RegisterSocialDto,
  StartSocialDto,
} from './dto/social-auth.dto.js';

@Controller('auth/social')
export class SocialAuthController {
  constructor(
    private readonly social: SocialAuthService,
    private readonly providers: SocialProviderService,
    private readonly limits: AuthRateLimitService,
  ) {}
  private ip(request: Request) {
    return (request.ip || request.socket.remoteAddress || 'unknown').slice(
      0,
      200,
    );
  }
  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth/social',
      maxAge: 600000,
    };
  }
  @Get('providers')
  options(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return { success: true, data: this.social.options(), error: null };
  }
  @Post('start')
  @HttpCode(200)
  async start(@Req() request: Request, @Body() dto: StartSocialDto) {
    await this.limits.consume(
      'SOCIAL_START_IP',
      this.ip(request),
      20,
      10 * 60000,
    );
    return { success: true, data: await this.social.start(dto), error: null };
  }
  @Get('begin')
  async begin(@Query('state') state: unknown, @Res() response: Response) {
    const result = await this.social.begin(state);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.cookie(
      this.social.cookieName(result.state),
      result.cookie,
      this.cookieOptions(),
    );
    response.redirect(303, result.url);
  }
  @Get('callback/:provider')
  async callback(
    @Param('provider') raw: string,
    @Query('state') state: unknown,
    @Query('code') code: unknown,
    @Query('error') error: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const provider = providerName(raw);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    let redirect: string;
    try {
      await this.limits.consume(
        'SOCIAL_CALLBACK_IP',
        this.ip(request),
        60,
        10 * 60000,
      );
      const cookie =
        typeof state === 'string'
          ? request.cookies?.[this.social.cookieName(state)]
          : undefined;
      const target = await this.social.callback(
        provider,
        state,
        code,
        cookie,
        typeof error === 'string',
      );
      redirect = target;
    } catch {
      // Provider errors and authorization codes must never reach logs or URLs.
      const target = new URL(
        '/auth/social/callback',
        this.providers.origins().web,
      );
      target.searchParams.set('error', 'failed');
      redirect = target.href;
    } finally {
      if (typeof state === 'string' && /^[A-Za-z0-9_-]{43}$/.test(state)) {
        const { maxAge: _maxAge, ...options } = this.cookieOptions();
        response.clearCookie(this.social.cookieName(state), options);
      }
    }
    response.redirect(303, redirect);
  }
  @Post('exchange')
  @HttpCode(200)
  async exchange(
    @Req() request: Request,
    @Body() dto: ExchangeSocialDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.limits.consume(
      'SOCIAL_EXCHANGE_IP',
      this.ip(request),
      60,
      10 * 60000,
    );
    const result = await this.social.exchange(dto);
    if (result.kind === 'session') return this.finish(response, result.session);
    return { success: true, data: result, error: null };
  }
  @Post('register')
  @HttpCode(200)
  async register(
    @Req() request: Request,
    @Body() dto: RegisterSocialDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.limits.consume('REGISTER_IP', this.ip(request), 5, 60 * 60000);
    return this.finish(response, await this.social.register(dto));
  }
  @Post('connect')
  @HttpCode(200)
  async connect(
    @Req() request: Request,
    @Body() dto: ConnectSocialDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.limits.consume('LOGIN_IP', this.ip(request), 20, 10 * 60000);
    return this.finish(
      response,
      await this.social.connect(dto.ticket, dto.password),
    );
  }
  private finish(
    response: Response,
    result: Awaited<ReturnType<SocialAuthService['register']>>,
  ) {
    setAuthRefreshCookie(response, result.data.refreshToken);
    const { refreshToken: _refreshToken, ...data } = result.data;
    return { ...result, data: { kind: 'session' as const, ...data } };
  }
}
