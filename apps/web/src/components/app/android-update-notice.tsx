'use client';

import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { ANDROID_STORE_URL, UPDATE_SNOOZE_KEY, UPDATE_SNOOZE_MS, androidUpdateNotice, installedAndroidVersion,
  updateIsSnoozed, type AndroidStoreUpdate, type AndroidUpdateNotice as UpdateNotice, type AndroidVersionPolicy } from '@/lib/android-update';
import styles from './android-update-notice.module.css';

declare global { interface Window { __fcAndroidUpdate?: AndroidStoreUpdate; } }

export function AndroidUpdateNotice() {
  const [notice, setNotice] = useState<UpdateNotice | null>(null);
  const memorySnooze = useRef<{ key: string; until: number } | null>(null);
  useEffect(() => {
    const installed = installedAndroidVersion(navigator.userAgent);
    if (!installed) return;
    let active = true, pending = false, nextCheckAt = 0;
    let policy: AndroidVersionPolicy | null = null;
    const controller = new AbortController();
    const display = () => {
      if (!active) return;
      const next = androidUpdateNotice(policy, window.__fcAndroidUpdate);
      let snoozed = false;
      try { snoozed = next !== null && updateIsSnoozed(localStorage.getItem(UPDATE_SNOOZE_KEY), next.key, Date.now()); } catch { /* Storage may be unavailable. */ }
      const memory = memorySnooze.current;
      setNotice(next && !snoozed && !(memory?.key === next.key && memory.until > Date.now()) ? next : null);
    };
    const check = async () => {
      if (!active || document.visibilityState === 'hidden' || !navigator.onLine) return;
      display();
      if (pending || Date.now() < nextCheckAt) return;
      pending = true; nextCheckAt = Date.now() + 60_000;
      try {
        const result = await apiRequest<{ data: AndroidVersionPolicy }>(`/mobile/android/version?versionName=${encodeURIComponent(installed)}`,
          { cache: 'no-store', signal: controller.signal });
        if (!active) return;
        policy = result.data; nextCheckAt = Date.now() + 10 * 60_000; display();
      } catch { /* An optional update check must not interrupt matches or login. */ }
      finally { pending = false; }
    };
    const refresh = () => { void check(); };
    window.addEventListener('fc-arena:android-update', display);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, 60_000);
    void Promise.resolve().then(refresh);
    return () => {
      active = false; controller.abort(); clearInterval(timer);
      window.removeEventListener('fc-arena:android-update', display);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  if (!notice) return null;
  const later = () => {
    try { localStorage.setItem(UPDATE_SNOOZE_KEY, JSON.stringify({ key: notice.key, until: Date.now() + UPDATE_SNOOZE_MS })); } catch { /* Keep the in-memory snooze. */ }
    memorySnooze.current = { key: notice.key, until: Date.now() + UPDATE_SNOOZE_MS }; setNotice(null);
  };
  return (
    <section className={styles.notice} aria-label="App update available">
      <div className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" /></svg></div>
      <div className={styles.content}>
        <h2>Update available{notice.versionName ? ` · ${notice.versionName}` : ''}</h2>
        <p>Update FC Arena for the latest features and improvements.</p>
        <div className={styles.actions}><a href={ANDROID_STORE_URL}>Update app</a><button type="button" onClick={later} aria-label="Remind me later">Later</button></div>
      </div>
    </section>
  );
}
