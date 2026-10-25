'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { FcCrest, FcErrorState, FcLoadingScreen, FcPanel, FcStatusBadge } from '@/components/fc/fc-ui';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';

type League = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  rules: string | null;
  region: string | null;
  members: number;
  maxMembers: number;
  tournamentCount: number;
  alreadyMember: boolean;
  applicationStatus: string | null;
  creator: { username: string; fullName: string; profileImageUrl: string | null };
};

export default function ExploreLeagueDetailPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [current, response] = await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{ data: { league: League } }>(`/leagues/discover/${leagueId}`),
        ]);
        setUser(current);
        setLeague(response.data.league);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'League could not be loaded.');
      }
    })();
  }, [leagueId]);

  async function requestJoin() {
    if (!league || busy || league.alreadyMember || league.applicationStatus === 'PENDING' || league.members >= league.maxMembers) return;
    setBusy(true);
    setError('');
    try {
      const response = await authenticatedRequest<{ data: { message: string } }>(`/leagues/${league.id}/join-request`, { method: 'POST' });
      setMessage(response.data.message);
      setLeague((current) => current ? { ...current, applicationStatus: 'PENDING' } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join request could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <FcErrorState message={error} />;
  if (!user || !league) return <FcLoadingScreen label="Loading League..." />;

  return <AppShell playerName={user.player?.identity?.inGameName || user.fullName}><div className="space-y-6"><BackHeader backHref="/leagues/explore" backLabel="Explore Leagues" eyebrow="Public League Preview" title={league.name} subtitle="A safe public summary. Full League tools are available after joining." /><FcPanel className="p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-start"><FcCrest name={league.name} imageUrl={league.logoUrl} size="lg" /><div className="min-w-0 flex-1"><h2 className="text-2xl font-black">{league.name}</h2><p className="mt-2 text-sm text-slate-500">Created by <span className="font-black text-slate-300">{league.creator.username}</span>{league.region ? ` · ${league.region}` : ''}</p><div className="mt-4 flex flex-wrap gap-2"><FcStatusBadge label={`${league.members}/${league.maxMembers} players`} tone={league.members >= league.maxMembers ? 'amber' : 'cyan'} /><FcStatusBadge label={`${league.tournamentCount} tournaments`} tone="slate" /></div></div></div><p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-400">{league.description || 'No description has been added yet.'}</p>{league.rules ? <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">League rules</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-400">{league.rules}</p></div> : null}<div className="mt-6 flex flex-wrap gap-3">{league.alreadyMember ? <Link href={`/leagues/${league.id}`} className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019]">Open League</Link> : league.applicationStatus === 'PENDING' ? <FcStatusBadge label="Join request pending" tone="amber" /> : <button type="button" disabled={busy || league.members >= league.maxMembers} onClick={() => void requestJoin()} className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019] disabled:opacity-40">{busy ? 'Sending...' : league.members >= league.maxMembers ? 'League full' : 'Request to Join'}</button>}</div></FcPanel>{message ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">{message}</div> : null}<Link href="/leagues/explore" className="text-sm font-black text-sky-300">← Back to Explore Leagues</Link></div></AppShell>;
}
