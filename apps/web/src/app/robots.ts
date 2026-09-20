import type {
  MetadataRoute,
} from 'next';


const BASE_URL =
  'https://fcarena.in';


export default function robots():
  MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent:
          '*',

        allow:
          '/',

        disallow: [
          '/api/',
          '/dashboard',
          '/admin/',
          '/profile',
          '/settings',
          '/career/',
          '/matches/',
          '/more',
          '/notifications',
          '/community/',
          '/leaderboards',
          '/awards',
          '/match-system',
          '/leagues',
          '/tournaments',
          '/fixtures',
          '/about',
          '/login',
          '/register',
          '/forgot-password',
          '/verify-email',
          '/tournaments/*/wizard/',
          '/leagues/*/settings',
          '/fixtures/manage',
          '/fixtures/generate',
        ],
      },
    ],

    sitemap:
      `${BASE_URL}/sitemap.xml`,

    host:
      BASE_URL,
  };
}
