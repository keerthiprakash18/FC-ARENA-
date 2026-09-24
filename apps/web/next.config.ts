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

const nextConfig: NextConfig = {
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
