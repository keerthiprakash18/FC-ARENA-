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
      'Strict-Transport-Security',
    value:
      'max-age=31536000; includeSubDomains',
  },
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
  // One stable build identifier, shared by all instances of this deployment.
  // Does not touch Android versions, cookies or local settings.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA,

  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
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
