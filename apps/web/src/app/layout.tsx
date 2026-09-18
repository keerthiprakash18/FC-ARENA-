import type {
  Metadata,
  Viewport,
} from 'next';

import {
  ServiceWorkerRegister,
} from '@/components/pwa/service-worker-register';

import './globals.css';

export const metadata: Metadata = {
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
    '#05080d',
};

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}