'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from './auth-client';
import { useRecoverableLoad } from './use-recoverable-load';

export interface CareerScopeData {
  availableLeagues?: { id: string; name: string; isMember: boolean }[];
  scope?: { leagueId: string | null; name: string };
}
export function careerHref(path: string, leagueId: string | null) {
  return leagueId ? `${path}?leagueId=${encodeURIComponent(leagueId)}` : path;
}
export function useCareerData<T>() {
  const leagueId = useSearchParams().get('leagueId');
  const [record, setRecord] = useState<{ leagueId: string | null; user: CurrentUser; career: T } | null>(null);
  const load = useRecoverableLoad(async signal => {
    const [user, response] = await Promise.all([
      getCurrentUser({ signal }), authenticatedRequest<{ data: T }>(careerHref('/players/me/career', leagueId), { signal }),
    ]);
    if (!signal.aborted) setRecord({ leagueId, user, career: response.data });
  }, leagueId ?? 'overall');
  const current = record?.leagueId === leagueId ? record : null;
  return { ...load, user: current?.user ?? null, career: current?.career ?? null, leagueId };
}
