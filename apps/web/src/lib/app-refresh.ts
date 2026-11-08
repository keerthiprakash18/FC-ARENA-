'use client';

import { useEffect, useRef } from 'react';

type Handler = (signal?: AbortSignal) => Promise<unknown> | unknown;
const handlers = new Set<Handler>();

export function registerAppRefresh(handler: Handler) {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

/** Revalidate mounted reads together; never recreate the page or replay a mutation. */
export function refreshAppReads() {
  const current = [...handlers];
  return Promise.allSettled(current.map(handler => Promise.resolve().then(() => handler())))
    .then(results => ({ handled: current.length, ok: results.every(result => result.status === 'fulfilled' && result.value !== false) }));
}

export function useAppRefresh(handler: Handler, scope = '') {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    const controller = new AbortController();
    const unsubscribe = registerAppRefresh(() => latest.current(controller.signal));
    return () => { controller.abort(); unsubscribe(); };
  }, [scope]);
}
