import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, sign, createHmac } from 'node:crypto';
import { SocialProviderService } from './social-provider.service.js';

describe('provider token verification at the trusted endpoint', () => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 }),
    wrong = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = {
    ...pair.publicKey.export({ format: 'jwk' }),
    kid: 'test-key',
    use: 'sig',
    alg: 'RS256',
  };
  const nonce = 'N'.repeat(43),
    state = 'S'.repeat(43),
    verifier = 'V'.repeat(43);
  function idToken(
    extra: Record<string, unknown> = {},
    invalidSignature = false,
  ) {
    const now = Math.floor(Date.now() / 1000),
      enc = (data: unknown) =>
        Buffer.from(JSON.stringify(data)).toString('base64url');
    const input =
      enc({ alg: 'RS256', kid: 'test-key' }) +
      '.' +
      enc({
        iss: 'https://accounts.google.com',
        aud: 'web-client',
        sub: 'google-user',
        iat: now,
        exp: now + 300,
        nonce,
        email: 'player@example.invalid',
        email_verified: true,
        name: 'Test Player',
        ...extra,
      });
    return (
      input +
      '.' +
      sign(
        'RSA-SHA256',
        Buffer.from(input),
        invalidSignature ? wrong.privateKey : pair.privateKey,
      ).toString('base64url')
    );
  }
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'web-client');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-only');
    vi.stubEnv('FACEBOOK_CLIENT_ID', 'fb-client');
    vi.stubEnv('FACEBOOK_CLIENT_SECRET', 'test-only');
    vi.stubEnv('FACEBOOK_GRAPH_VERSION', 'v24.0');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  function google(payload: Record<string, unknown> = {}, bad = false) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://oauth2.googleapis.com/token')
          return Response.json({
            access_token: 'synthetic-access',
            token_type: 'Bearer',
            expires_in: 300,
            id_token: idToken(payload, bad),
          });
        if (url === 'https://www.googleapis.com/oauth2/v3/certs')
          return Response.json({ keys: [jwk] });
        throw Error('No unreviewed provider endpoint allowed');
      }),
    );
    return new SocialProviderService().identity(
      'google',
      state,
      'synthetic-code',
      verifier,
      nonce,
    );
  }
  it('validates Google issuer, audience, nonce, signature and verified email', async () => {
    await expect(google()).resolves.toMatchObject({
      provider: 'google',
      subject: 'google-user',
      email: 'player@example.invalid',
      emailVerified: true,
    });
  });
  it.each([
    { nonce: 'other' },
    { aud: 'other-client' },
    { iss: 'https://untrusted.example' },
    { email_verified: false },
    { exp: 1 },
  ])('rejects wrong claims %j', async (claims) => {
    await expect(google(claims)).rejects.toMatchObject({ status: 400 });
  });
  it('rejects an attacker-signed Google identity even when claims look correct', async () => {
    await expect(google({}, true)).rejects.toMatchObject({ status: 400 });
  });
  it('Facebook uses the reviewed version, bearer header and app-secret proof', async () => {
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, options?: RequestInit) => {
        const url = new URL(String(input));
        if (url.pathname === '/v24.0/oauth/access_token')
          return Response.json({
            access_token: 'synthetic-access',
            token_type: 'bearer',
            expires_in: 300,
          });
        expect(url.hostname).toBe('graph.facebook.com');
        expect(url.pathname).toBe('/v24.0/me');
        expect(new Headers(options?.headers).get('Authorization')).toBe(
          'Bearer synthetic-access',
        );
        expect(url.searchParams.has('access_token')).toBe(false);
        expect(url.searchParams.get('appsecret_proof')).toBe(
          createHmac('sha256', 'test-only')
            .update('synthetic-access')
            .digest('hex'),
        );
        return Response.json({
          id: '12345',
          email: 'facebook@example.invalid',
          name: 'Facebook Player',
        });
      },
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      new SocialProviderService().identity(
        'facebook',
        state,
        'synthetic-code',
        verifier,
        nonce,
      ),
    ).resolves.toMatchObject({
      provider: 'facebook',
      subject: '12345',
      emailVerified: false,
    });
  });
  it('leaves unconfigured providers unavailable without contacting them', () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    vi.stubEnv('FACEBOOK_GRAPH_VERSION', '');
    const service = new SocialProviderService();
    expect(service.providers()).toEqual({ google: false, facebook: false });
  });
});
