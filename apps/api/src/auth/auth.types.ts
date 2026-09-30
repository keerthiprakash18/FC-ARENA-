export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access';
  sid?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}