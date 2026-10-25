'use client';

/* eslint-disable react-hooks/exhaustive-deps -- Discovery reloads are intentionally keyed by page and sort state. */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FcCrest, FcEmptyState, FcErrorState, FcPanel, FcStatusBadge } from '@/components/fc/fc-ui';
import { authenticatedRequest } from '@/lib/auth-client';

type League = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  region: string | null;
  members: number;
  maxMembers: number;
  tournamentCount: number;
  isFull: boolean;
  alreadyMember: boolean;
  applicationStatus: string | null;
  creator: { username: string; fullName: string; profileImageUrl: string | null };
};

type DiscoverResponse = {
  data: {
    leagues: League[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
};

export function LeagueExplorer() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState<'POPULAR' | 'NEWEST' | 'ACTIVE'>('POPULAR');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<DiscoverResponse['data']['pagination'] | null>(null);
  const [busyLeagueId, setBusyLeagueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10', sort });
      if (search.trim()) params.set('search', search.trim());
      if (region.trim()) params.set('region', region.trim());
      const response = await authenticatedRequest<DiscoverResponse>(`/leagues/discover?${params.toString()}`);
      setLeagues(response.data.leagues);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Leagues could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [page, sort]);

  async function requestJoin(league: League) {
    if (league.alreadyMember || league.applicationStatus === 'PENDING' || league.isFull || busyLeagueId) return;
    setBusyLeagueId(league.id);
    setMessage('');
    setError('');
    try {
      const response = await authenticatedRequest<{ data: { message: string } }>(`/leagues/${league.id}/join-request`, { method: 'POST' });
      setMessage(response.data.message);
      setLeagues((current) => current.map((item) => item.id === league.id ? { ...item, applicationStatus: 'PENDING' } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join request could not be sent.');
    } finally {
      setBusyLeagueId(null);
    }
  }

  return (
    <div className="space-y-6">
      <FcPanel className="p-5 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(1); void load(); } }} placeholder="Search leagues or creators" className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-4 text-sm outline-none focus:border-sky-400/50" />
          <input value={region} onChange={(event) => setRegion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(1); void load(); } }} placeholder="Region" className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-4 text-sm outline-none focus:border-sky-400/50" />
          <select value={sort} onChange={(event) => { setPage(1); setSort(event.target.value as typeof sort); }} className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-4 text-sm outline-none"><option value="POPULAR">Most players</option><option value="NEWEST">Newest</option><option value="ACTIVE">Recently active</option></select>
          <button type="button" onClick={() => { setPage(1); void load(); }} className="min-h-12 rounded-xl bg-sky-400 px-5 text-sm font-black text-[#031019]">Search</button>
        </div>
      </FcPanel>

      {message ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">{message}</div> : null}
      {error ? <FcErrorState message={error} /> : null}

      {loading ? <FcPanel className="p-8 text-center text-sm text-slate-500">Loading leagues...</FcPanel> : leagues.length === 0 ? <FcEmptyState title="No public leagues found" description="Try a different search or region, or create your own league." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{leagues.map((league) => <FcPanel key={league.id} className="p-5"><div className="flex items-start gap-4"><FcCrest name={league.name} imageUrl={league.logoUrl} size="lg" /><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-black">{league.name}</h2><p className="mt-1 text-xs text-slate-500">{league.region || 'Region not specified'}</p><p className="mt-1 text-xs text-slate-500">Created by <span className="font-black text-slate-300">{league.creator.username}</span></p></div></div><p className="mt-4 line-clamp-2 min-h-12 text-sm leading-6 text-slate-500">{league.description || 'A community League on FC ARENA.'}</p><div className="mt-4 flex flex-wrap gap-2"><FcStatusBadge label={`${league.members}/${league.maxMembers} players`} tone={league.isFull ? 'amber' : 'cyan'} /><FcStatusBadge label={`${league.tournamentCount} tournaments`} tone="slate" /></div><div className="mt-5 flex flex-wrap gap-2"><Link href={`/leagues/explore/${league.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-black text-slate-200">View League</Link>{league.alreadyMember ? <FcStatusBadge label="Member" tone="emerald" /> : league.applicationStatus === 'PENDING' ? <FcStatusBadge label="Request pending" tone="amber" /> : <button type="button" disabled={league.isFull || busyLeagueId === league.id} onClick={() => void requestJoin(league)} className="min-h-10 rounded-xl bg-sky-400 px-4 text-sm font-black text-[#031019] disabled:opacity-40">{busyLeagueId === league.id ? 'Sending...' : league.isFull ? 'Full' : 'Request to Join'}</button>}</div></FcPanel>)}</div>}

      {pagination && pagination.totalPages > 1 ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Showing page {pagination.page} of {pagination.totalPages} · {pagination.total} leagues</p><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="min-h-10 rounded-xl border border-white/10 px-4 text-sm font-black disabled:opacity-30">Previous</button><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="min-h-10 rounded-xl border border-white/10 px-4 text-sm font-black disabled:opacity-30">Next</button></div></div> : null}
    </div>
  );
}
