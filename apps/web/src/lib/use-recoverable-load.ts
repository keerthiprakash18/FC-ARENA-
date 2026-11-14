'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from './api';
import { registerAppRefresh } from './app-refresh';
import { leagueInviteQuery } from './league-invite';

/** Initial reads recover in place; refresh keeps the successfully loaded page mounted. */
export function useRecoverableLoad(load: (signal: AbortSignal) => Promise<void>, scope = '', { preserveLeagueInvite = false } = {}) {
  const router = useRouter();
  const currentLoad = useRef(load);
  const runner = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { currentLoad.current = load; });

  useEffect(() => {
    const controller = new AbortController();
    let pending: Promise<boolean> | null = null;
    let loaded = false, failed = false, transient = false, failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const visible = () => navigator.onLine !== false && document.visibilityState !== 'hidden';
    const run = (background = false): Promise<boolean> => {
      if (controller.signal.aborted) return Promise.resolve(false);
      if (pending) return pending;
      if (timer !== undefined) clearTimeout(timer);
      const work = Promise.resolve().then(async () => { try {
        await currentLoad.current(controller.signal);
        if (controller.signal.aborted) return false;
        loaded = true; failed = false; failures = 0; setError(''); setRefreshError('');
        return true;
      } catch (caught) {
        if (controller.signal.aborted) return false;
        if (caught instanceof ApiError && caught.status === 401) {
          const invite = preserveLeagueInvite ? leagueInviteQuery(window.location.search) : '';
          router.replace(`/login${invite}`);
          return false;
        }
        failed = true;
        transient = caught instanceof ApiError && [0, 408, 429, 500, 502, 503, 504].includes(caught.status);
        const message = caught instanceof Error ? caught.message : 'Unable to load this page. Please retry.';
        if (background && loaded) setRefreshError(message); else setError(message);
        // Bound automatic retries, pause while offline/hidden, and never replay a write.
        if (transient && visible() && failures < 3) timer = setTimeout(() => { if (visible()) void run(background); }, 1000 * 2 ** failures++);
        return false;
      } finally { if (pending === work) pending = null; } });
      pending = work;
      return work;
    };
    const refresh = () => run(true);
    runner.current = refresh;
    const unsubscribe = registerAppRefresh(refresh);
    const resume = () => { if (failed && transient && visible()) { failures = 0; void run(loaded); } };
    void run();
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      controller.abort(); unsubscribe();
      if (runner.current === refresh) runner.current = () => Promise.resolve(false);
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener('online', resume); window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [scope, attempt, router, preserveLeagueInvite]);

  const reload = useCallback(() => runner.current(), []);
  const retry = useCallback(() => { setError(''); setAttempt(value => value + 1); }, []);
  return { error, refreshError, retry, reload };
}
