import type { NextConfig } from 'next';

const configuredApiTarget =
  process.env.NODE_ENV ===
  'production'
    ? 'https://api.fcarena.in/api'
    : process.env.API_PROXY_TARGET ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000/api';

const apiProxyTarget =
  configuredApiTarget.replace(
    /\/+$/,
    '',
  );

const securityHeaders = [
  {
    key:
      'X-Content-Type-Options',
    value:
      'nosniff',
  },
  {
    key:
      'Referrer-Policy',
    value:
      'strict-origin-when-cross-origin',
  },
  {
    key:
      'X-Frame-Options',
    value:
      'DENY',
  },
  {
    key:
      'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=()',
  },
  {
    key:
      'Content-Security-Policy',
    value:
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://api.fcarena.in; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source:
          '/(.*)',
        headers:
          securityHeaders,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source:
          '/api/auth/:path*',

        destination:
          `${apiProxyTarget}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
