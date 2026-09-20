import type {
  Metadata,
  Viewport,
} from 'next';

import {
  ServiceWorkerRegister,
} from '@/components/pwa/service-worker-register';

import {
  ThemeProvider,
} from '@/components/theme/theme-provider';

import './globals.css';

export const metadata: Metadata = {
  metadataBase:
    new URL('https://fcarena.in'),

  title: 'FC ARENA',

  description:
    'Premium football and esports competition platform',

  applicationName:
    'FC ARENA',

  manifest:
    '/manifest.webmanifest',

  appleWebApp: {
    capable: true,
    title: 'FC ARENA',
    statusBarStyle: 'black-translucent',
  },

  icons: {
    icon: [
      {
        url: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],

    apple:
      '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width:
    'device-width',

  initialScale:
    1,

  viewportFit:
    'cover',

  themeColor:
    '#061E35',
};

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  const themeBootstrap = `
    (function () {
      try {
        var value = localStorage.getItem('fc-arena-theme-preference');
        var theme = value === 'LUXURY_GOLD'
          ? 'luxury-gold'
          : 'classic-blue';
        document.documentElement.dataset.theme = theme;
      } catch (_) {
        document.documentElement.dataset.theme = 'classic-blue';
      }
    })();
  `;

  return (
    <html
      lang="en"
      data-theme="classic-blue"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              themeBootstrap,
          }}
        />
      </head>

      <body data-ui-build="theme-system-v1">
        <ThemeProvider>
          <ServiceWorkerRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}