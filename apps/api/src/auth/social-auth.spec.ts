import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { SocialAuthService } from './social-auth.service.js';
import { SocialAuthController } from './social-auth.controller.js';

const hash = (value: string) =>
  createHash('sha256').update(value).digest('base64url');
describe('social authorization binding and one-time completion', () => {
  const state = 'S'.repeat(43),
    verifier = 'V'.repeat(43),
    code = 'C'.repeat(43),
    ticket = 'T'.repeat(43),
    cookie = 'K'.repeat(43);
  const identity = {
    provider: 'google' as const,
    subject: 'provider-user',
    email: 'player@example.invalid',
    emailVerified: true,
    fullName: 'Player',
  };
  function fixture() {
    const data = new Map<string, unknown>();
    const store = {
      put: vi.fn(async (kind: string, key: string, value: unknown) => {
        data.set(kind + key, value);
      }),
      read: vi.fn(
        async (kind: string, key: string) => data.get(kind + key) ?? null,
      ),
      take: vi.fn(async (kind: string, key: string) => {
        const value = data.get(kind + key) ?? null;
        data.delete(kind + key);
        return value;
      }),
      remove: vi.fn(async (kind: string, key: string) => {
        data.delete(kind + key);
      }),
      lock: vi.fn().mockResolvedValue(vi.fn()),
    };
    const provider = {
      providers: () => ({ google: true, facebook: true }),
      requireProvider: vi.fn(),
      origins: () => ({
        api: 'https://api.fcarena.in',
        web: 'https://fcarena.in',
      }),
      identity: vi.fn().mockResolvedValue(identity),
    };
    const auth = {
      loginSocial: vi.fn().mockResolvedValue(null),
      registerSocial: vi.fn().mockResolvedValue({ success: true }),
      connectSocial: vi.fn().mockResolvedValue({ success: true }),
    };
    const db = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    const limits = { consume: vi.fn(), clear: vi.fn() };
    const service = new SocialAuthService(
      store as never,
      provider as never,
      auth as never,
      db as never,
      limits as never,
    );
    return { data, store, provider, auth, db, limits, service };
  }
  it('wrong verifier cannot consume the legitimate one-time grant', async () => {
    const f = fixture();
    f.data.set('code' + code, { state, challenge: hash(verifier), identity });
    await expect(
      f.service.exchange({ state, code, verifier: 'W'.repeat(43) }),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.data.has('code' + code)).toBe(true);
    const result = await f.service.exchange({ state, code, verifier });
    expect(result.kind).toBe('register');
    await expect(
      f.service.exchange({ state, code, verifier }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('never links an existing email automatically or issues a session before password confirmation', async () => {
    const f = fixture();
    f.db.user.findUnique.mockResolvedValue({ id: 'existing' } as never);
    f.data.set('code' + code, { state, challenge: hash(verifier), identity });
    const result = await f.service.exchange({ state, code, verifier });
    expect(result.kind).toBe('connect');
    expect(f.auth.connectSocial).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('session');
  });
  it.each(['bad cookie', 'provider mix-up'])(
    'rejects %s before provider network calls',
    async (reason) => {
      const f = fixture();
      f.data.set('oauth' + state, {
        provider: 'google',
        cookie: hash(cookie),
        challenge: hash(verifier),
      });
      await expect(
        f.service.callback(
          reason === 'provider mix-up' ? 'facebook' : 'google',
          state,
          'provider-code',
          reason === 'bad cookie' ? 'B'.repeat(43) : cookie,
          false,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(f.provider.identity).not.toHaveBeenCalled();
    },
  );
  it('callback redirects contain only an opaque one-time code and state', async () => {
    const f = fixture();
    f.data.set('oauth' + state, {
      provider: 'google',
      cookie: hash(cookie),
      challenge: hash(verifier),
      verifier,
      nonce: 'nonce',
    });
    const url = new URL(
      await f.service.callback(
        'google',
        state,
        'provider-code',
        cookie,
        false,
      ),
    );
    expect(url.origin).toBe('https://fcarena.in');
    expect([...url.searchParams.keys()].sort()).toEqual(['code', 'state']);
    expect(url.href).not.toContain(identity.email);
    await expect(
      f.service.callback(
        'google',
        state,
        'provider-code',
        cookie,
        false,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('cannot use a registration ticket for linking, and retains failed profile submissions for retry', async () => {
    const f = fixture();
    f.data.set('ticket' + ticket, { identity, kind: 'register' });
    await expect(
      f.service.connect(ticket, 'Password123'),
    ).rejects.toMatchObject({ status: 400 });
    f.auth.registerSocial.mockRejectedValueOnce(new Error('Invalid profile'));
    const dto = {
      ticket,
      fullName: 'Player',
      inGameName: 'Player',
      dateOfBirth: '1995-01-01',
      phoneNumber: '+919876543210',
    };
    await expect(f.service.register(dto)).rejects.toThrow('Invalid profile');
    expect(f.data.has('ticket' + ticket)).toBe(true);
    await f.service.register(dto);
    expect(f.data.has('ticket' + ticket)).toBe(false);
  });
  it('clears callback state cookies before sending a redirect response', async () => {
    const social = {
      cookieName: () => 'state-cookie',
      callback: vi
        .fn()
        .mockResolvedValue('https://fcarena.in/auth/social/callback'),
    };
    const controller = new SocialAuthController(
      social as never,
      { origins: () => ({ web: 'https://fcarena.in' }) } as never,
      { consume: vi.fn() } as never,
    );
    const steps: string[] = [];
    const response = {
      setHeader: vi.fn(),
      clearCookie: () => steps.push('clear'),
      redirect: () => steps.push('redirect'),
    };
    await controller.callback(
      'google',
      state,
      'provider-code',
      undefined,
      { cookies: { 'state-cookie': 'proof' }, socket: {} } as never,
      response as never,
    );
    expect(steps).toEqual(['clear', 'redirect']);
  });
});
