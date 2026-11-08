'use client';

import { useEffect, useRef, useState } from 'react';
import { newerWebRelease, freshAppUrl } from '@/lib/web-release';
import { retireNativeServiceWorker } from '@/lib/service-worker-lifecycle';
import styles from './web-release-notice.module.css';

/** The APK and the web UI have separate releases. Never replace an active form automatically. */
export function WebReleaseNotice() {
  const [release, setRelease] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const snoozed = useRef<{ release: string; until: number } | null>(null);
  useEffect(() => {
    if (!/FC-Arena-Android\//i.test(navigator.userAgent)) return;
    let active = true, pending = false, nextCheck = 0;
    let request: AbortController | null = null;
    async function check() {
      if (!active || pending || navigator.onLine === false || document.visibilityState === 'hidden' || Date.now() < nextCheck) return;
      pending = true; nextCheck = Date.now() + 30000;
      request = new AbortController();
      const deadline = setTimeout(() => request?.abort(), 6000);
      try {
        const response = await fetch(`/web-release?check=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin', signal: request.signal });
        if (!response.ok) return;
        const next = newerWebRelease(document.body.dataset.webRelease, await response.json());
        if (!active) return;
        const ignored = snoozed.current;
        setRelease(next && !(ignored?.release === next && ignored.until > Date.now()) ? next : null);
      } catch { /* Optional checks do not interrupt matches, drafts or sign-in. */ }
      finally { clearTimeout(deadline); pending = false; }
    }
    const resume = () => { void check(); };
    void check();
    const timer = setInterval(resume, 60000);
    window.addEventListener('focus', resume); window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false; request?.abort(); clearInterval(timer);
      window.removeEventListener('focus', resume); window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);

  if (!release) return null;
  async function reload() {
    if (reloading || !release || navigator.onLine === false || document.querySelector('[data-refresh-lock="true"]')) return;
    setReloading(true);
    // Keep the refresh cookie, settings and storage. Unregistering our old worker
    // and using a fresh document URL also recovers shells with an old HTTP cache.
    let deadline: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([retireNativeServiceWorker(true), new Promise(resolve => { deadline = setTimeout(resolve, 2000); })]);
    if (deadline !== undefined) clearTimeout(deadline);
    window.location.replace(freshAppUrl(window.location.href, release));
  }
  return <section className={styles.notice} aria-label="Latest app improvements">
    <h2>New app improvements available</h2>
    <p>Save any changes, then reload for the latest features.</p>
    <div className={styles.actions}>
      <button type="button" onClick={() => void reload()} disabled={reloading}>{reloading ? 'Reloading…' : 'Reload latest'}</button>
      <button type="button" disabled={reloading} onClick={() => { snoozed.current = { release, until: Date.now() + 15 * 60000 }; setRelease(null); }}>Later</button>
    </div>
  </section>;
}
