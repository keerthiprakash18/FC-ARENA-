'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PremiumHero } from '@/components/fc/premium-ui';
import { FcStatusBadge } from '@/components/fc/fc-ui';
import { apiRequest } from '@/lib/api';
import { LanguageSwitcher } from '@/components/app/language-switcher';
import { useArenaLocale } from '@/lib/locale';

interface Fixture {
  id: string; fixtureCode: string; roundName: string; status: string;
  scheduledAt: string | null; home: string; away: string;
  result: { homeScore: number; awayScore: number } | null;
}
interface Tournament {
  tournament: { id: string; code: string; name: string; visibility?: string;
    league: {name:string}; status: string; logoUrl:string|null };
  fixtures: Fixture[];
}
export default function PublicMatchdayPage() {
  const { code } = useParams<{code:string}>();
  const { t } = useArenaLocale();
  const [data,setData]=useState<Tournament|null>(null);
  const [error,setError]=useState('');
  const [lastRefresh,setLastRefresh]=useState<number|null>(null);
  const [offline,setOffline]=useState(false);
  const refresh=useCallback(async (signal?: AbortSignal)=>{
    try {
      const response=await apiRequest<{data:Tournament}>('/public/tournaments/'+encodeURIComponent(code),{signal});
      if(signal?.aborted)return;
      setData(response.data);setError('');setLastRefresh(Date.now());
    }catch(err){
      if(signal?.aborted)return;
      setError(err instanceof Error?err.message:'Unable to load public matchday.');
    }
  },[code]);
  useEffect(()=>{
    const c=new AbortController();
    const check=()=>{setOffline(!navigator.onLine);if(navigator.onLine && document.visibilityState==='visible')void refresh(c.signal);};
    check();
    const timer=window.setInterval(check,20_000);
    window.addEventListener('focus',check);
    window.addEventListener('online',check);
    window.addEventListener('offline',check);
    document.addEventListener('visibilitychange',check);
    return ()=>{c.abort();window.clearInterval(timer);window.removeEventListener('focus',check);
      window.removeEventListener('online',check);window.removeEventListener('offline',check);
      document.removeEventListener('visibilitychange',check);};
  },[refresh]);
  const live=useMemo(()=>data?.fixtures.filter(f=>f.status==='LIVE' && !f.result)??[],[data]);
  const upcoming=useMemo(()=>data?.fixtures.filter(f=>!f.result && f.status!=='CANCELLED' && f.status!=='LIVE')
    .sort((a,b)=>(a.scheduledAt??'9999').localeCompare(b.scheduledAt??'9999')).slice(0,20)??[],[data]);
  const results=useMemo(()=>data?.fixtures.filter(f=>f.result).slice().sort((a,b)=>
    (b.scheduledAt??'').localeCompare(a.scheduledAt??'')).slice(0,20)??[],[data]);
  return <main className="fc-public-page min-h-screen bg-[var(--theme-background)] text-[var(--theme-text)]">
    <header className="border-b border-[var(--theme-border)] bg-[var(--theme-surface)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link className="font-black text-lg" href="/">FC ARENA <span className="text-[var(--theme-primary)]">/ MATCHDAY</span></Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          <LanguageSwitcher compact />
          <Link href={`/public/tournaments/${encodeURIComponent(code)}`} className="theme-secondary-button inline-flex min-h-11 items-center rounded-xl border px-3">{t('openTournament')}</Link>
          <Link href="/login" className="theme-primary-button inline-flex min-h-11 items-center rounded-xl px-3">Play FC ARENA</Link>
        </nav>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {data ? <PremiumHero eyebrow={data.tournament.league.name} title={data.tournament.name}
        description={t('spectatorDescription')}
        crest={data.tournament.name} /> : <h1 className="text-2xl font-bold">FC ARENA {t('spectator')}</h1>}
      <aside aria-label="Scoreboard refresh status" className="theme-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
        <p className="theme-secondary-text text-sm" role="status">{offline ? t('offlineLast') :
          error ? t('connectionIssue') : t('publicData')}
          {lastRefresh ? ' · Checked '+new Date(lastRefresh).toLocaleTimeString() : ''}</p>
        <button type="button" onClick={()=>void refresh()} className="theme-secondary-button min-h-11 rounded-xl border px-4 text-sm font-semibold">{t('refresh')}</button>
      </aside>
      {error && !data ? <section role="alert" className="theme-panel rounded-2xl border p-5">
        <h2 className="text-lg font-bold">{t('matchCenterUnavailable')}</h2>
        <p className="theme-secondary-text mt-2 text-sm">{error}</p>
        <p className="mt-2 text-sm">{t('publicOnly')}</p>
      </section> : null}
      {data ? <>
        <section aria-label="Live fixture status" className="space-y-3">
          <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-black">🔴 {t('liveFixtures')}</h2>
            <FcStatusBadge label={live.length ? live.length+' active' : 'None active'} /></div>
          {live.length ? <div className="grid gap-3 sm:grid-cols-2">{live.map(f=><article key={f.id} className="theme-panel rounded-2xl border p-4">
            <div className="flex justify-between gap-2"><span className="theme-secondary-text text-xs">{f.roundName}</span><FcStatusBadge label="LIVE" tone="red" /></div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
              <strong className="break-words">{f.home}</strong><span className="text-xl font-black">vs</span><strong className="break-words">{f.away}</strong>
            </div>
            <p className="theme-secondary-text mt-3 text-center text-xs">{t('awaitingResult')}</p>
          </article>)}</div> : <p className="theme-secondary-text text-sm">{t('noLiveMatches')}</p>}
        </section>
        <section aria-label="Upcoming match schedule" className="space-y-3">
          <h2 className="text-xl font-black">{t('upcoming')}</h2>
          {upcoming.length ? <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map(f=><article key={f.id} className="theme-panel rounded-2xl border p-4">
              <div className="theme-secondary-text flex items-center justify-between gap-3 text-xs"><span>{f.roundName}</span><span>{f.scheduledAt?new Date(f.scheduledAt).toLocaleString():t('kickoffPending')}</span></div>
              <div className="mt-3 flex items-center justify-between gap-3 font-bold"><span className="break-words">{f.home}</span><span className="text-[var(--theme-primary)]">VS</span><span className="break-words text-right">{f.away}</span></div>
            </article>)}
          </div> : <p className="theme-secondary-text text-sm">{t('noUpcomingMatches')}</p>}
        </section>
        <section aria-label="Verified match results" className="space-y-3">
          <h2 className="text-xl font-black">🏆 {t('verifiedResults')}</h2>
          {results.length ? <div className="grid gap-3 sm:grid-cols-2">
            {results.map(f=><article key={f.id} className="theme-panel rounded-2xl border p-4">
              <p className="theme-secondary-text text-xs">{f.roundName} · {t('verifiedScore')}</p>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <strong className="break-words">{f.home}</strong>
                <span className="rounded-xl bg-[var(--theme-primary-soft)] px-3 py-2 text-lg font-black tabular-nums">
                  {f.result!.homeScore} – {f.result!.awayScore}</span>
                <strong className="break-words text-right">{f.away}</strong>
              </div>
            </article>)}
          </div> : <p className="theme-secondary-text text-sm">{t('noVerifiedResults')}</p>}
        </section>
      </> : null}
    </div>
  </main>;
}
