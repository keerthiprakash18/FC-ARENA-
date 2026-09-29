'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const isAndroidWrapper =
      /FC-Arena-Android\//i.test(
        navigator.userAgent,
      );

    if (isAndroidWrapper) {
      // Native WebView already has its own HTTP cache. Avoid layering the
      // PWA service worker cache on top of it, which can make app updates
      // feel stale and adds unnecessary work in the Android wrapper.
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map(
              (registration) =>
                registration.unregister(),
            ),
          ),
        )
        .catch(
          () =>
            undefined,
        );

      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
      } catch (error) {
        console.error(
          'FC ARENA service worker registration failed:',
          error,
        );
      }
    };

    if (document.readyState === 'complete') {
      void register();
      return;
    }

    window.addEventListener(
      'load',
      () => {
        void register();
      },
      {
        once: true,
      },
    );
  }, []);

  return null;
}