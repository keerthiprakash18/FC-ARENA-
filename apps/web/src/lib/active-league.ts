'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const CHANGE = 'fc-arena:active-league-changed';
const fallback = new Map<string, string>();
const PREFIX = 'fc-arena:active-league:';
type Membership = { membershipType?: string | null; league: { id: string } };

function read(userId: string | null | undefined) {
  if (!userId || typeof window === 'undefined') return '';
  if (fallback.has(userId)) return fallback.get(userId)!;
  try { const value = localStorage.getItem(`${PREFIX}${userId}`); if (value) return value; } catch { /* Session storage remains optional fallback. */ }
  try {
    return sessionStorage.getItem(`${PREFIX}${userId}`) ??
      sessionStorage.getItem(`fc-arena:tournament-league:${userId}`) ?? '';
  } catch { return fallback.get(userId) ?? ''; }
}

export function rememberActiveLeague(userId: string, leagueId: string) {
  if (typeof window === 'undefined' || !userId || !leagueId) return;
  const changed = read(userId) !== leagueId;
  fallback.set(userId, leagueId);
  try { localStorage.setItem(`${PREFIX}${userId}`, leagueId); } catch { /* Memory/session still keep navigation consistent. */ }
  try { sessionStorage.setItem(`${PREFIX}${userId}`, leagueId); } catch { /* Storage is optional. */ }
  if (changed) window.dispatchEvent(new Event(CHANGE));
}

function subscribe(listener: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === null) fallback.clear();
    else if (event.key.startsWith(PREFIX)) fallback.delete(event.key.slice(PREFIX.length));
    else return;
    listener();
  };
  window.addEventListener(CHANGE, listener);
  window.addEventListener('storage', storageChanged);
  return () => { window.removeEventListener(CHANGE, listener); window.removeEventListener('storage', storageChanged); };
}
const serverSnapshot = () => '';

/** One account-scoped selection for Home, Cup and Matches; validate against current access. */
export function useActiveLeague(userId: string | null | undefined, memberships: readonly Membership[], explicitId?: string | null) {
  const snapshot = useCallback(() => read(userId), [userId]);
  const remembered = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const explicit = memberships.find(item => item.league.id === explicitId)?.league.id;
  const selectedId = explicit ?? memberships.find(item => item.league.id === remembered)?.league.id ??
    (memberships.find(item => item.membershipType === 'PRIMARY') ?? memberships[0])?.league.id ?? '';
  const validRemembered = memberships.find(item => item.league.id === remembered)?.league.id;
  useEffect(() => { if (userId && (explicit || validRemembered)) rememberActiveLeague(userId, explicit ?? validRemembered!); }, [userId, explicit, validRemembered]);
  const select = useCallback((id: string) => {
    if (userId && memberships.some(item => item.league.id === id)) rememberActiveLeague(userId, id);
  }, [userId, memberships]);
  return [selectedId, select] as const;
}

/** A successfully loaded league/tournament route supplies its canonical league. */
export function useRouteLeague(userId: string | null | undefined, leagueId: string | null | undefined) {
  useEffect(() => { if (userId && leagueId) rememberActiveLeague(userId, leagueId); }, [userId, leagueId]);
}
