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

    const hadController =
      Boolean(navigator.serviceWorker.controller);

    const release =
      process.env.NEXT_PUBLIC_FC_ARENA_RELEASE_SHA ??
      'unknown';

    const reloadKey =
      `fc-arena-sw-controller-${release}`;

    const onControllerChange = () => {
      if (!hadController) return;

      try {
        if (sessionStorage.getItem(reloadKey)) return;
        sessionStorage.setItem(reloadKey, '1');
      } catch {
        return;
      }

      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    );

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
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => {
      window.removeEventListener('load', register);
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
    };
  }, []);
  return null;
}
