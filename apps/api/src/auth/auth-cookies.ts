import type { Response } from 'express';
export function setAuthRefreshCookie(response: Response, token: string) {
  const production = process.env.NODE_ENV === 'production';
  response.cookie('fc_arena_refresh_token', token, {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
