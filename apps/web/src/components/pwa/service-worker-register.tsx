'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (/FC-Arena-Android\//i.test(navigator.userAgent)) {
      // Retire legacy PWA workers once; HTTP caching remains enabled. Do not
      // clear caches or reload on every mount/startup. A legacy controller can
      // finish this document and is gone at the next normal navigation.
      const retireLegacyWorker = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (!registrations.length) return;
          await Promise.all(registrations.map((registration) => registration.unregister()));
          if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.filter((name) => name.startsWith('fc-arena-'))
              .map((name) => caches.delete(name)));
          }
        } catch {
          // Best effort: offline startup must remain usable.
        }
      };
      void retireLegacyWorker();
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        console.error('FC ARENA service worker registration failed:', error);
      });
    };
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
