import type { NextConfig } from 'next';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const rootPackage = JSON.parse(
  readFileSync(
    new URL('../../package.json', import.meta.url),
    'utf8',
  ),
) as { version?: string };

const appVersion =
  rootPackage.version ??
  'unknown';

function resolveWebReleaseSha(): string {
  const configured =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.FC_ARENA_RELEASE_SHA;

  if (configured?.trim()) {
    return configured.trim();
  }

  try {
    return execFileSync(
      'git',
      ['rev-parse', 'HEAD'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
  } catch {
    return 'unknown';
  }
}

const webReleaseSha =
  resolveWebReleaseSha();

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
];

// Next.js/Vercel limits custom deployment IDs to 32 characters; Git commit
// SHAs are 40 characters. Keep one stable, per-build prefix across instances.
const deploymentId = (
  process.env.NEXT_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA
)?.slice(0, 32);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_FC_ARENA_VERSION:
      appVersion,
    NEXT_PUBLIC_FC_ARENA_RELEASE_SHA:
      webReleaseSha,
  },

  // One stable build identifier, shared by all instances of this deployment.
  // Does not touch Android versions, cookies or local settings.
  deploymentId,

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
      {
        source:
          '/api/telemetry/:path*',

        destination:
          `${apiProxyTarget}/telemetry/:path*`,
      },
    ];
  },
};

export default nextConfig;
