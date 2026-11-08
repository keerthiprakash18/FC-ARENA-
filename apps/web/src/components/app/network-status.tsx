'use client';
import { useSyncExternalStore } from 'react';

function subscribe(notify: () => void) {
  window.addEventListener('online', notify); window.addEventListener('offline', notify);
  return () => { window.removeEventListener('online', notify); window.removeEventListener('offline', notify); };
}

export function NetworkStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true);
  if (online) return null;
  return <p role="status" className="fc-notice mb-4 text-sm" data-tone="warning">You’re offline. Loaded information stays visible. Reconnect to get updates.</p>;
}
