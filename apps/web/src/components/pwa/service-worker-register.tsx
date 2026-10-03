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
