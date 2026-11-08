'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedRequest } from './auth-client';
import { registerAppRefresh } from './app-refresh';
import type { TeamChoiceEntry } from './chosen-team-names';

/** Availability is scoped to the tournament; submission still has an atomic server check. */
export function useTeamChoices(tournamentId: string, open: boolean) {
  const [record, setRecord] = useState<{ scope: string; entries: TeamChoiceEntry[]; error: string } | null>(null);
  const visible = useRef(open);
  useEffect(() => { visible.current = open; }, [open]);
  const runner = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  useEffect(() => {
    const controller = new AbortController();
    let pending: Promise<boolean> | null = null;
    const load = () => {
      if (pending) return pending;
      if (controller.signal.aborted) return Promise.resolve(false);
      const work = Promise.resolve().then(async () => {
        try {
          const response = await authenticatedRequest<{ data: { entries: TeamChoiceEntry[] } }>(`/tournaments/${tournamentId}/entries`, { signal: controller.signal });
          if (controller.signal.aborted) return false;
          setRecord({ scope: tournamentId, entries: response.data.entries, error: '' });
          return true;
        } catch {
          if (!controller.signal.aborted) setRecord(previous => ({ scope: tournamentId, entries: previous?.scope === tournamentId ? previous.entries : [], error: 'Could not check chosen teams. Retry to choose a team.' }));
          return false;
        } finally { if (pending === work) pending = null; }
      });
      pending = work;
      return work;
    };
    runner.current = load;
    void load();
    const unsubscribe = registerAppRefresh(load);
    const resume = () => { if (visible.current && navigator.onLine !== false && document.visibilityState !== 'hidden') void load(); };
    const timer = setInterval(resume, 15000);
    window.addEventListener('focus', resume); window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      controller.abort(); unsubscribe(); clearInterval(timer);
      if (runner.current === load) runner.current = () => Promise.resolve(false);
      window.removeEventListener('focus', resume); window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [tournamentId]);
  useEffect(() => { if (open) void runner.current(); }, [open]);
  const refresh = useCallback(() => runner.current(), []);
  const current = record?.scope === tournamentId ? record : null;
  return { entries: current?.entries ?? [], ready: Boolean(current && !current.error), error: current?.error ?? '', refresh };
}
