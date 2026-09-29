'use client';

import { useEffect } from 'react';

const ANDROID_NATIVE_CACHE_VERSION =
  '2026-09-29-mobile-v3';

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
      const refreshNativeWrapper =
        async () => {
          try {
            const registrations =
              await navigator.serviceWorker
                .getRegistrations();

            await Promise.all(
              registrations.map(
                (registration) =>
                  registration.unregister(),
              ),
            );

            if ('caches' in window) {
              const cacheNames =
                await caches.keys();

              await Promise.all(
                cacheNames.map(
                  (cacheName) =>
                    caches.delete(
                      cacheName,
                    ),
                ),
              );
            }

            const currentVersion =
              localStorage.getItem(
                'fc-arena-native-cache-version',
              );

            if (
              currentVersion !==
              ANDROID_NATIVE_CACHE_VERSION
            ) {
              localStorage.setItem(
                'fc-arena-native-cache-version',
                ANDROID_NATIVE_CACHE_VERSION,
              );

              const nextUrl =
                new URL(
                  window.location.href,
                );

              nextUrl.searchParams.set(
                'native_ui',
                ANDROID_NATIVE_CACHE_VERSION,
              );

              window.location.replace(
                nextUrl.toString(),
              );
            }
          } catch {
            // Cache cleanup is best-effort. Never block app startup.
          }
        };

      void refreshNativeWrapper();
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
