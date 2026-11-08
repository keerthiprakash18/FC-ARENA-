'use client';

import { useEffect } from 'react';
import { retireNativeServiceWorker } from '@/lib/service-worker-lifecycle';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (/FC-Arena-Android\//i.test(navigator.userAgent)) {
      void retireNativeServiceWorker();
      return;
    }

    // The worker caches icons only. Taking control must not interrupt a match,
    // registration or login by automatically replacing the current document.

    const register = () => {
      void navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        .then((registration) => registration.update())
        .catch((error) => {
          console.error('FC ARENA service worker registration failed:', error);
        });
    };
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      window.removeEventListener('load', register);
    };
  }, []);
  return null;
}
