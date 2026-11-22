import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes, createHmac } from 'node:crypto';
import { isEmail } from 'class-validator';
import * as oauth from 'oauth4webapi';
import { fetchWithTimeout } from '../security/external-request.js';
import type { SocialProvider, VerifiedSocialIdentity } from './social.types.js';

const GOOGLE: oauth.AuthorizationServer = {
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
};
const boundedFetch: typeof fetch = (url, options) =>
  fetchWithTimeout(url, options, 10000);
export const socialRandom = () => randomBytes(32).toString('base64url');
export function providerName(value: unknown): SocialProvider {
  if (value === 'google' || value === 'facebook') return value;
  throw new BadRequestException('Choose Google or Facebook.');
}

@Injectable()
export class SocialProviderService {
  origins() {
    const api = new URL(
      process.env.SOCIAL_API_ORIGIN || 'https://api.fcarena.in',
    );
    const web = new URL(process.env.SOCIAL_WEB_ORIGIN || 'https://fcarena.in');
    for (const url of [api, web]) {
      if (
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        (url.protocol !== 'https:' &&
          !(
            process.env.NODE_ENV !== 'production' &&
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)
          ))
      ) {
        throw new Error('Configure trusted HTTPS social sign-in origins.');
      }
    }
    return { api: api.origin, web: web.origin };
  }
  providers() {
    return {
      google: this.enabled('google'),
      facebook: this.enabled('facebook'),
    };
  }
  requireProvider(provider: SocialProvider) {
    if (!this.enabled(provider))
      throw new ServiceUnavailableException(
        `${provider === 'google' ? 'Google' : 'Facebook'} sign-in is not available yet. Use email sign-in.`,
      );
  }
  private enabled(provider: SocialProvider) {
    const prefix = provider.toUpperCase();
    return Boolean(
      process.env[`${prefix}_CLIENT_ID`]?.trim() &&
      process.env[`${prefix}_CLIENT_SECRET`]?.trim() &&
      (provider !== 'facebook' ||
        /^v\d{1,2}\.0$/.test(process.env.FACEBOOK_GRAPH_VERSION ?? '')),
    );
  }
  private configuration(provider: SocialProvider) {
    this.requireProvider(provider);
    const prefix = provider.toUpperCase(),
      version = process.env.FACEBOOK_GRAPH_VERSION;
    const as: oauth.AuthorizationServer =
      provider === 'google'
        ? GOOGLE
        : {
            issuer: 'https://www.facebook.com',
            authorization_endpoint: `https://www.facebook.com/${version}/dialog/oauth`,
            token_endpoint: `https://graph.facebook.com/${version}/oauth/access_token`,
          };
    const client: oauth.Client = {
      client_id: process.env[`${prefix}_CLIENT_ID`]!.trim(),
      ...(provider === 'google'
        ? { id_token_signed_response_alg: 'RS256' }
        : {}),
    };
    return {
      as,
      client,
      secret: process.env[`${prefix}_CLIENT_SECRET`]!.trim(),
      redirect: this.origins().api + '/api/auth/social/callback/' + provider,
    };
  }
  async authorization(
    provider: SocialProvider,
    state: string,
    verifier: string,
    nonce: string,
  ) {
    const { as, client, redirect } = this.configuration(provider);
    const url = new URL(as.authorization_endpoint!);
    url.searchParams.set('client_id', client.client_id);
    url.searchParams.set('redirect_uri', redirect);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set(
      'scope',
      provider === 'google' ? 'openid email profile' : 'email public_profile',
    );
    if (provider === 'google') {
      url.searchParams.set(
        'code_challenge',
        await oauth.calculatePKCECodeChallenge(verifier),
      );
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('nonce', nonce);
    }
    return url.href;
  }
  async identity(
    provider: SocialProvider,
    state: string,
    code: string,
    verifier: string,
    nonce: string,
  ): Promise<VerifiedSocialIdentity> {
    const { as, client, secret, redirect } = this.configuration(provider);
    try {
      const params = oauth.validateAuthResponse(
        as,
        client,
        new URLSearchParams({ state, code }),
        state,
      );
      const response = await oauth.authorizationCodeGrantRequest(
        as,
        client,
        oauth.ClientSecretPost(secret),
        params,
        redirect,
        provider === 'google' ? verifier : oauth.nopkce,
        {
          [oauth.customFetch]: boundedFetch,
          signal: AbortSignal.timeout(12000),
        },
      );
      const tokens = await oauth.processAuthorizationCodeResponse(
        as,
        client,
        response,
        provider === 'google'
          ? { expectedNonce: nonce, requireIdToken: true }
          : {},
      );
      if (provider === 'google') {
        await oauth.validateApplicationLevelSignature(as, response, {
          [oauth.customFetch]: boundedFetch,
          signal: AbortSignal.timeout(12000),
        });
        const claims = oauth.getValidatedIdTokenClaims(tokens)!;
        if (
          typeof claims.sub !== 'string' ||
          !claims.sub ||
          claims.sub.length > 255 ||
          claims.email_verified !== true ||
          typeof claims.email !== 'string' ||
          !isEmail(claims.email)
        )
          throw Error();
        return {
          provider,
          subject: claims.sub,
          email: claims.email.trim().toLowerCase(),
          emailVerified: true,
          fullName:
            typeof claims.name === 'string' ? claims.name.slice(0, 120) : '',
        };
      }
      const url = new URL(
        `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION}/me`,
      );
      url.searchParams.set('fields', 'id,name,email');
      url.searchParams.set(
        'appsecret_proof',
        createHmac('sha256', secret).update(tokens.access_token).digest('hex'),
      );
      const profileResponse = await boundedFetch(url, {
        headers: { Authorization: 'Bearer ' + tokens.access_token },
      });
      if (!profileResponse.ok) throw Error();
      const profile = (await profileResponse.json()) as Record<string, unknown>;
      if (typeof profile.id !== 'string' || !/^\d{1,255}$/.test(profile.id))
        throw Error();
      return {
        provider,
        subject: profile.id,
        email:
          typeof profile.email === 'string' && isEmail(profile.email)
            ? profile.email.trim().toLowerCase()
            : null,
        emailVerified: false,
        fullName:
          typeof profile.name === 'string' ? profile.name.slice(0, 120) : '',
      };
    } catch {
      throw new BadRequestException(
        'Social sign-in could not be verified. Please start again.',
      );
    }
  }
}
