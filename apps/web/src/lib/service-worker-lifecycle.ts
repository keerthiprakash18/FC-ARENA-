const RETIRED_KEY = 'fc-arena-sw-retired-v2';

export async function retireNativeServiceWorker(): Promise<void> {
  try {
    if (sessionStorage.getItem(RETIRED_KEY)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      if (!worker) continue;
      const url = new URL(worker.scriptURL);
      if (url.origin === window.location.origin && url.pathname === '/sw.js') {
        const removed = await registration.unregister();
        if (!removed) return; // Retry on the next mount; do not mark failed work done.
      }
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith('fc-arena-')).map(name => caches.delete(name)));
    }
    sessionStorage.setItem(RETIRED_KEY, '1');
  } catch {
    // Storage may be unavailable. Never block login or clear cookies/settings.
  }
}
