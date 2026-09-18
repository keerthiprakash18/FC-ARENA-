'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
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