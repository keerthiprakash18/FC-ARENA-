import type {
  MetadataRoute,
} from 'next';

const BASE_URL =
  'https://fcarena.in';

const publicRoutes = [
  '/',
  '/about',
  '/help',
  '/privacy',
  '/terms',
] as const;

export default function sitemap():
  MetadataRoute.Sitemap {
  return publicRoutes.map(
    (
      path,
    ) => ({
      url:
        BASE_URL +
        path,
      lastModified:
        new Date(),
      changeFrequency:
        path ===
        '/'
          ? 'weekly'
          : 'monthly',
      priority:
        path ===
        '/'
          ? 1
          : 0.6,
    }),
  );
}
