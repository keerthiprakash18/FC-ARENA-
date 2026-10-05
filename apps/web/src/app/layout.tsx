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

import { ConfirmationProvider } from '@/components/fc/confirmation-provider';
import './globals.css';
import './design-tokens.css';
import './modernization.css';
import './native-android.css';

export const metadata: Metadata = {
  metadataBase:
    new URL('https://fcarena.in'),

  title: 'FC ARENA',

  description:
    'Premium football and esports competition platform',

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

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  const themeBootstrap = `
    (function () {
      if (/FC-Arena-Android\\//i.test(navigator.userAgent)) {
        document.documentElement.dataset.nativeApp = 'android';
      }
      try {
        var value = localStorage.getItem('fc-arena-theme-preference');
        var theme = value === 'CLASSIC_BLUE'
          ? 'classic-blue'
          : 'luxury-gold';
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
          dangerouslySetInnerHTML={{
            __html:
              themeBootstrap,
          }}
        />
      </head>

      <body data-ui-build="push-rank-history-v4">
        <ThemeProvider>
          <ConfirmationProvider />
          <ServiceWorkerRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}