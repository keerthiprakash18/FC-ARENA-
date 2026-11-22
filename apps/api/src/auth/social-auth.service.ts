import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AuthService } from './auth.service.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  SocialProviderService,
  socialRandom,
} from './social-provider.service.js';
import { SocialStateStore } from './social-state.store.js';
import type { SocialProvider, VerifiedSocialIdentity } from './social.types.js';
import type {
  ExchangeSocialDto,
  RegisterSocialDto,
  StartSocialDto,
} from './dto/social-auth.dto.js';

interface Attempt {
  provider: SocialProvider;
  challenge: string;
  verifier: string;
  nonce: string;
  cookie: string;
}
interface Grant {
  state: string;
  challenge: string;
  identity: VerifiedSocialIdentity;
}
interface Ticket {
  identity: VerifiedSocialIdentity;
  kind: 'register' | 'connect';
}
const hash = (value: string) =>
  createHash('sha256').update(value).digest('base64url');
const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const valid = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const expired = () =>
  new BadRequestException(
    'This sign-in expired or was already used. Please start again.',
  );

@Injectable()
export class SocialAuthService {
  constructor(
    private readonly store: SocialStateStore,
    private readonly providers: SocialProviderService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly limits: AuthRateLimitService,
  ) {}
  options() {
    return this.providers.providers();
  }
  cookieName(state: string) {
    return 'fc_social_' + hash(state).slice(0, 16);
  }
  async start(dto: StartSocialDto) {
    this.providers.requireProvider(dto.provider);
    const state = socialRandom();
    await this.store.put('start', state, {
      provider: dto.provider,
      challenge: dto.challenge,
    });
    return {
      state,
      url:
        this.providers.origins().api + '/api/auth/social/begin?state=' + state,
    };
  }
  async begin(state: unknown) {
    if (!valid(state)) throw expired();
    const start = await this.store.take<
      Pick<Attempt, 'provider' | 'challenge'>
    >('start', state);
    if (!start) throw expired();
    const cookie = socialRandom(),
      verifier = socialRandom(),
      nonce = socialRandom();
    const url = await this.providers.authorization(
      start.provider,
      state,
      verifier,
      nonce,
    );
    await this.store.put('oauth', state, {
      ...start,
      verifier,
      nonce,
      cookie: hash(cookie),
    } satisfies Attempt);
    return { url, cookie, state };
  }
  async callback(
    provider: SocialProvider,
    state: unknown,
    code: unknown,
    cookie: unknown,
    cancelled: boolean,
  ) {
    if (!valid(state) || !valid(cookie)) throw expired();
    const attempt = await this.store.read<Attempt>('oauth', state);
    if (
      !attempt ||
      attempt.provider !== provider ||
      !same(attempt.cookie, hash(cookie))
    )
      throw expired();
    if (!(await this.store.take('oauth', state))) throw expired();
    const target = new URL(
      '/auth/social/callback',
      this.providers.origins().web,
    );
    target.searchParams.set('state', state);
    if (cancelled) {
      target.searchParams.set('error', 'cancelled');
      return target.href;
    }
    if (typeof code !== 'string' || !code || code.length > 4096)
      throw expired();
    const identity = await this.providers.identity(
      provider,
      state,
      code,
      attempt.verifier,
      attempt.nonce,
    );
    const grant = socialRandom();
    await this.store.put(
      'code',
      grant,
      { state, challenge: attempt.challenge, identity } satisfies Grant,
      120,
    );
    target.searchParams.set('code', grant);
    return target.href;
  }
  async exchange(dto: ExchangeSocialDto) {
    const grant = await this.store.read<Grant>('code', dto.code);
    if (
      !grant ||
      !same(grant.state, dto.state) ||
      !same(grant.challenge, hash(dto.verifier))
    )
      throw expired();
    if (!(await this.store.take('code', dto.code))) throw expired();
    const session = await this.auth.loginSocial(grant.identity);
    if (session) return { kind: 'session' as const, session };
    if (!grant.identity.email)
      throw new BadRequestException(
        'Facebook did not share an email. Use Google or email to create your account.',
      );
    const existing = await this.prisma.user.findUnique({
      where: { email: grant.identity.email },
      select: { id: true },
    });
    const kind = existing ? ('connect' as const) : ('register' as const),
      ticket = socialRandom();
    await this.store.put('ticket', ticket, {
      identity: grant.identity,
      kind,
    } satisfies Ticket);
    return {
      kind,
      ticket,
      profile: {
        fullName: grant.identity.fullName,
        email: grant.identity.email,
        provider: grant.identity.provider,
      },
    };
  }
  private async withTicket<T>(
    token: string,
    kind: Ticket['kind'],
    action: (identity: VerifiedSocialIdentity) => Promise<T>,
  ) {
    const release = await this.store.lock(token);
    if (!release)
      throw new ConflictException(
        'Sign-in is already being completed. Please wait.',
      );
    try {
      const ticket = await this.store.read<Ticket>('ticket', token);
      if (!ticket || ticket.kind !== kind) throw expired();
      const result = await action(ticket.identity);
      await this.store.remove('ticket', token);
      return result;
    } finally {
      await release();
    }
  }
  register(dto: RegisterSocialDto) {
    return this.withTicket(dto.ticket, 'register', (identity) =>
      this.auth.registerSocial(identity, dto),
    );
  }
  connect(ticket: string, password: string) {
    return this.withTicket(ticket, 'connect', async (identity) => {
      await this.limits.consume(
        'LOGIN_IDENTIFIER',
        identity.email ?? identity.subject,
        5,
        15 * 60 * 1000,
      );
      const result = await this.auth.connectSocial(identity, password);
      await this.limits.clear(
        'LOGIN_IDENTIFIER',
        identity.email ?? identity.subject,
      );
      return result;
    });
  }
}
