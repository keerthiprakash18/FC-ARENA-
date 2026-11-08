'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authenticatedRequest } from '@/lib/auth-client';
import type { CareerScopeData } from '@/lib/career-scope';

export function CareerLeagueFilter({ data }: { data: CareerScopeData }) {
  const params = useSearchParams(), pathname = usePathname(), router = useRouter();
  const leagueId = params.get('leagueId');
  const leagues = data.availableLeagues ?? [];
  const selected = leagues.find(league => league.id === leagueId);
  const [rank, setRank] = useState<{ leagueId: string; position: number | null } | null>(null);
  useEffect(() => {
    if (!selected?.isMember) return;
    const controller = new AbortController();
    void authenticatedRequest<{ data: { myPosition: number | null } }>(`/leagues/${selected.id}/rankings`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setRank({ leagueId: selected.id, position: response.data.myPosition }); })
      .catch(() => { /* Career statistics remain available if the optional leaderboard is offline. */ });
    return () => controller.abort();
  }, [selected?.id, selected?.isMember]);
  const choose = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set('leagueId', id); else next.delete('leagueId');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  return <section className="theme-panel rounded-2xl border p-4" aria-label="Career league filter">
    <p className="mb-3 text-xs font-bold uppercase tracking-wider theme-muted">Career scope</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose career league">
      {[{ id: null, name: 'Overall' }, ...leagues].map(league => <button key={league.id ?? 'overall'} type="button"
        aria-pressed={leagueId === league.id} onClick={() => choose(league.id)}
        className={`${leagueId === league.id ? 'theme-primary-button' : 'theme-secondary-button'} min-h-11 max-w-full rounded-xl px-4 py-2 text-sm font-bold break-words`}>
        {league.name}
      </button>)}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs theme-muted">
      <p>{selected ? `Verified performance in ${selected.name}.` : 'Combined career statistics across your leagues.'}</p>
      {selected?.isMember ? <Link className="font-bold underline underline-offset-4" href={`/leagues/${selected.id}/rankings`}>
        {rank?.leagueId === selected.id && rank.position !== null ? `League rank #${rank.position} · Leaderboard →` : 'Open league leaderboard →'}
      </Link> : null}
    </div>
  </section>;
}
