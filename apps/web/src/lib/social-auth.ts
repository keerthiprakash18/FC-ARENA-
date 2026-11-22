import { apiRequest } from './api';
import { leagueInviteQuery } from './league-invite';
export type SocialProvider = 'google' | 'facebook';
const PREFIX = 'fc:social:';
export async function beginSocialSignIn(provider: SocialProvider) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encode = (value: Uint8Array) =>
    btoa(String.fromCharCode(...value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const verifier = encode(bytes),
    challenge = encode(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(verifier),
        ),
      ),
    );
  const response = await apiRequest<{ data: { state: string; url: string } }>(
    '/auth/social/start',
    { method: 'POST', body: JSON.stringify({ provider, challenge }) },
  );
  const { state, url } = response.data,
    parsed = new URL(url);
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    parsed.pathname !== '/api/auth/social/begin' ||
    parsed.searchParams.get('state') !== state ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    !(
      (parsed.protocol === 'https:' &&
        ['api.fcarena.in', 'fcarena.in'].includes(parsed.hostname)) ||
      (parsed.protocol === 'http:' &&
        ['127.0.0.1', 'localhost'].includes(parsed.hostname))
    )
  )
    throw Error('Could not start secure sign-in. Please retry.');
  // Do not leave old PKCE secrets behind in a long-lived WebView tab.
  for (const key of Object.keys(sessionStorage))
    if (key.startsWith(PREFIX)) {
      try {
        if (
          Date.now() - JSON.parse(sessionStorage.getItem(key)!).createdAt >
          600000
        )
          sessionStorage.removeItem(key);
      } catch {
        sessionStorage.removeItem(key);
      }
    }
  sessionStorage.setItem(
    PREFIX + state,
    JSON.stringify({
      verifier,
      createdAt: Date.now(),
      invite: leagueInviteQuery(window.location.search),
    }),
  );
  // The Android host opens this API-domain navigation in the system browser;
  // its existing verified App Link handler returns to this same WebView tab.
  window.location.assign(url);
}
export function takeSocialAttempt(state: string) {
  const key = PREFIX + state,
    raw = sessionStorage.getItem(key);
  if (!raw) return null;
  sessionStorage.removeItem(key);
  try {
    const value = JSON.parse(raw) as {
      verifier: string;
      createdAt: number;
      invite: string;
    };
    const age = Date.now() - value.createdAt;
    return typeof value.verifier === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(value.verifier) &&
      Number.isFinite(age) &&
      age >= 0 &&
      age <= 600000 &&
      typeof value.invite === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}
export function nativeSocialReturn(code: string, state: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9_-]{43}$/.test(state))
    return null;
  return `intent://fcarena.in/auth/social/callback?code=${code}&state=${state}#Intent;scheme=https;package=in.fcarena.app;end`;
}
