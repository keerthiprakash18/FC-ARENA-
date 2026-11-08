'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { invalidateAppReadCaches } from '@/lib/auth-client';
import { refreshAppReads } from '@/lib/app-refresh';
import styles from './app-refresh.module.css';

const RefreshContext = createContext<{ refresh: () => void; refreshing: boolean; notice: string } | null>(null);

export function AppRefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({ path: '', refreshing: false, notice: '' });
  const active = useRef<{ key: string; generation: number } | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => {
    const key = window.location.pathname + window.location.search;
    if (navigator.onLine === false || active.current?.key === key || document.querySelector('[data-refresh-lock="true"]')) return;
    const id = ++generation.current;
    active.current = { key, generation: id };
    if (timer.current) clearTimeout(timer.current);
    invalidateAppReadCaches();
    setState({ path: window.location.pathname, refreshing: true, notice: '' });
    const started = Date.now();
    void refreshAppReads().then(async result => {
      if (result.handled === 0) { window.dispatchEvent(new Event('focus')); router.refresh(); }
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 300 - (Date.now() - started))));
      if (id !== generation.current) return;
      if (key !== window.location.pathname + window.location.search) { setState({ path: '', refreshing: false, notice: '' }); return; }
      setState({ path: window.location.pathname, refreshing: false, notice: result.ok ? '' : 'Could not refresh. Your loaded details are kept.' });
      if (!result.ok) timer.current = setTimeout(() => setState(current => ({ ...current, notice: '' })), 5000);
    }).catch(() => { if (id === generation.current) setState({ path: window.location.pathname, refreshing: false, notice: 'Could not refresh. Your loaded details are kept.' }); })
      .finally(() => { if (active.current?.generation === id) active.current = null; });
  }, [router]);
  useEffect(() => () => { generation.current++; if (timer.current) clearTimeout(timer.current); }, []);
  const current = state.path === pathname;
  return <RefreshContext.Provider value={{ refresh, refreshing: current && state.refreshing, notice: current ? state.notice : '' }}>{children}</RefreshContext.Provider>;
}

const PULL_THRESHOLD = 56;

/** A vertical pull at the document's top refreshes reads, preserving the URL and session. */
export function PullToRefresh() {
  const context = useContext(RefreshContext);
  const refresh = context?.refresh, refreshing = context?.refreshing;
  const [distance, setDistance] = useState(0);
  const busy = useRef(false);
  const frame = useRef<number | null>(null);
  const gesture = useRef<{ x: number; y: number; distance: number; pulling: boolean } | null>(null);
  useEffect(() => { busy.current = Boolean(refreshing); }, [refreshing]);
  useEffect(() => {
    if (!refresh) return;
    const html = document.documentElement, body = document.body;
    const previous = [html.style.overscrollBehaviorY, body.style.overscrollBehaviorY];
    html.style.overscrollBehaviorY = 'none'; body.style.overscrollBehaviorY = 'none';
    const atTop = () => window.scrollY <= 1 && (document.scrollingElement?.scrollTop ?? 0) <= 1;
    const cancel = () => { gesture.current = null; if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; setDistance(0); };
    const start = (event: TouchEvent) => {
      cancel();
      if (busy.current || navigator.onLine === false || event.touches.length !== 1 || !atTop() || document.querySelector('[data-refresh-lock="true"]')) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.fc-app-shell') ||
        target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],[data-no-pull-refresh]')) return;
      for (let parent: Element | null = target; parent && parent !== body && parent !== html; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1) return;
      }
      gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, distance: 0, pulling: false };
    };
    const move = (event: TouchEvent) => {
      const current = gesture.current;
      if (!current) return;
      if (event.touches.length !== 1 || !atTop() || navigator.onLine === false) { cancel(); return; }
      const dx = event.touches[0].clientX - current.x, dy = event.touches[0].clientY - current.y;
      if (!current.pulling && Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      if (dy <= -12 || (!current.pulling && Math.abs(dx) > Math.abs(dy) * 1.25)) { cancel(); return; }
      if (dy <= 0 || (!current.pulling && dy <= Math.abs(dx) * 1.15)) return;
      if (!event.cancelable) { cancel(); return; }
      current.pulling = true; event.preventDefault();
      current.distance = Math.min(88, dy * 0.44);
      if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; setDistance(gesture.current?.distance ?? 0); });
    };
    const end = () => {
      const ready = (gesture.current?.distance ?? 0) >= PULL_THRESHOLD;
      cancel();
      if (ready && navigator.onLine !== false) refresh();
    };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
    document.addEventListener('visibilitychange', cancel); window.addEventListener('offline', cancel);
    return () => {
      document.removeEventListener('touchstart', start); document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', cancel);
      document.removeEventListener('visibilitychange', cancel); window.removeEventListener('offline', cancel);
      html.style.overscrollBehaviorY = previous[0]; body.style.overscrollBehaviorY = previous[1];
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [refresh]);
  const label = context?.refreshing ? 'Refreshing…' : distance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh';
  return <>
    <button type="button" aria-label="Refresh app" disabled={!context || context.refreshing}
      onClick={context?.refresh} className="sr-only focus:not-sr-only focus:fixed focus:left-1/2 focus:top-20 focus:z-[70] focus:rounded-xl focus:bg-slate-900 focus:p-3 focus:text-white">Refresh app</button>
    <div role="status" aria-live="polite" aria-hidden={!(distance > 0 || refreshing || context?.notice)}
      data-phase={refreshing ? 'refreshing' : context?.notice ? 'error' : distance >= PULL_THRESHOLD ? 'ready' : distance > 0 ? 'pulling' : 'idle'}
      className={styles.indicator} style={{ transform: `translate3d(-50%, ${distance > 0 ? Math.min(12, distance * 0.14) : 0}px, 0)` }}>
      <span aria-hidden="true" className={`${styles.icon} ${refreshing ? styles.spinning : ''}`} style={{ rotate: `${Math.min(180, distance / PULL_THRESHOLD * 180)}deg` }}>↻</span>
      <span>{context?.notice || label}</span>
      {context?.notice ? <button type="button" onClick={refresh} className={styles.retry}>Retry</button> : null}
    </div>
  </>;
}
