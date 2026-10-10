import type {
  Metadata,
  Viewport,
} from 'next';
import { headers } from 'next/headers';

import {
  ServiceWorkerRegister,
} from '@/components/pwa/service-worker-register';

import {
  ThemeProvider,
} from '@/components/theme/theme-provider';

import { ConfirmationProvider } from '@/components/fc/confirmation-provider';
import './globals.css';
import './design-tokens.css';
import './modernization.css';
import './ux-polish.css';
import './interactions.css';
import './release-consistency.css';
import './premium-redesign.css';
import './native-android.css';

export const metadata: Metadata = {
  metadataBase:
    new URL('https://fcarena.in'),

  title: { default: 'FC ARENA — Football & esports competitions', template: '%s | FC ARENA' },

  description:
    'Organize leagues and tournaments, follow fixtures, confirm match results and celebrate player achievements with FC ARENA.',

  applicationName:
    'FC ARENA',

  manifest:
    '/manifest.webmanifest?v=7',

  appleWebApp: {
    capable: true,
    title: 'FC ARENA',
    statusBarStyle: 'black-translucent',
  },

  icons: {
    icon: [
      {
        url: '/icons/icon-192-v3.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icons/icon-512-v3.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],

    apple:
      '/icons/apple-touch-icon-v3.png',
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

export default async function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  const nonce =
    (await headers()).get('x-nonce') ??
    undefined;

  const themeBootstrap = `
    (function () {
      if (/FC-Arena-Android\\//i.test(navigator.userAgent)) {
        document.documentElement.dataset.nativeApp = 'android';
      }
      try {
        var value = localStorage.getItem('fc-arena-theme-preference');
        var themes = {
          LUXURY_GOLD: 'luxury-gold',
          CLASSIC_BLUE: 'classic-blue',
          CITY_SKY: 'city-sky',
          LONDON_RED: 'london-red',
          MERSEY_RED: 'mersey-red',
          MADRID_ROYAL: 'madrid-royal',
          CATALAN_NIGHTS: 'catalan-nights',
          MUNICH_RED: 'munich-red',
          PARIS_NIGHT: 'paris-night',
          MILAN_BLUE: 'milan-blue',
          MILAN_RED: 'milan-red',
          TURIN_MONO: 'turin-mono'
        };
        var theme = themes[value] || 'luxury-gold';
        document.documentElement.dataset.theme = theme;

        var modeValue = localStorage.getItem('fc-arena-display-mode');
        var mode = (modeValue === 'DARK' || (modeValue === 'SYSTEM' && window.matchMedia('(prefers-color-scheme: dark)').matches))
          ? 'dark'
          : 'light';

        document.documentElement.dataset.mode = mode;

      } catch (_) {
        document.documentElement.dataset.theme = 'luxury-gold';
        document.documentElement.dataset.mode = 'light';
      }
    })();
  `;

  return (
    <html
      lang="en"
      data-theme="luxury-gold"
      data-mode="light"
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              themeBootstrap,
          }}
        />
      </head>

      <body className="fc-premium" data-ui-build="premium-redesign">
        <ThemeProvider>
          <ConfirmationProvider />
          <ServiceWorkerRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}