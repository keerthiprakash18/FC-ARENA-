'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { FcEmptyState, FcPanel } from '@/components/fc/fc-ui';
import { ShareCard } from '@/components/fc/share-card';
import { authenticatedRequest, getCurrentUser } from '@/lib/auth-client';

interface Recap {
  id: string; name: string; status: string; startAt: string; endAt: string;
  matches: number; wins: number; draws: number; losses: number;
  teamGoalsFor: number; teamGoalsAgainst: number; winRate: number;
  officialRank: number | null; statsBasis: string; goalBasis: string;
  results: Array<{id:string;confirmedAt:string;outcome:'W'|'D'|'L';tournamentName:string}>;
}

export default function SeasonRecapsPage() {
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [playerName, setPlayerName] = useState('FC ARENA Player');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void Promise.all([
      authenticatedRequest<{ data: { recaps: Recap[] } }>('/players/me/season-recaps'),
      getCurrentUser(),
    ]).then(([response,user])=>{
      if (!active) return;
      setRecaps(response.data.recaps);
      setPlayerName(user.player?.identity?.inGameName || user.fullName);
    }).catch(err=>{ if(active) setError(err instanceof Error ? err.message : 'Unable to load season recap.'); })
      .finally(()=>{ if(active) setLoading(false); });
    return ()=>{ active=false; };
  },[]);
  return <SecondaryFeaturePage title={"Season Recaps"} eyebrow={"Verified season history"} backHref="/career" backLabel="Career"
    subtitle={"Real results from official Ballon seasons, including only verified player matches in eligible tournaments."}>
    {error ? <p role="alert" className="rounded-xl border border-[var(--theme-danger)] p-4 text-sm text-[var(--theme-danger)]">{error}</p> : null}
    {loading ? <p role="status" className="theme-secondary-text">{"Loading official seasons…"}</p> : !recaps.length ?
      <FcEmptyState title={"No official season available"} description={"Your season recap appears when an administrator publishes an official Ballon season. Career history remains available."} actionLabel={"Open career"} actionHref="/career" /> :
      <div className="grid gap-5">
        {recaps.map(recap => <FcPanel key={recap.id} className="overflow-hidden p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.13em] text-[var(--theme-primary)]">{"Official season"} · {recap.status}</p>
              <h2 className="mt-1 text-2xl font-black">{recap.name}</h2>
              <p className="theme-secondary-text mt-2 text-sm">{new Date(recap.startAt).toLocaleDateString()} – {new Date(recap.endAt).toLocaleDateString()}</p>
            </div>
            <ShareCard label={"Share season recap"} filename="fc-arena-season-recap"
              title={playerName + ' · ' + recap.name} lines={[
                recap.status === 'LOCKED' || recap.status === 'ARCHIVED' ? 'Official completed season' : 'Season progress to date',
                'Verified matches: ' + recap.matches,
                'Wins: ' + recap.wins + ' · Draws: ' + recap.draws + ' · Losses: ' + recap.losses,
                'Team-side goals: ' + recap.teamGoalsFor + ' · Conceded: ' + recap.teamGoalsAgainst,
                'Win rate: ' + recap.winRate + '%',
                ...(recap.officialRank ? ['Official season ranking: #' + recap.officialRank] : []),
              ]} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([["Matches", recap.matches], ["Wins", recap.wins],
              ["Team goals", recap.teamGoalsFor], ["Win rate", recap.winRate + '%']] as const)
              .map(([label,value]) => <div key={label} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-3">
                <strong className="text-2xl">{value}</strong><p className="theme-secondary-text mt-1 text-xs">{label}</p>
              </div>)}
          </div>
          {recap.officialRank ? <p className="mt-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-primary-soft)] p-3 font-bold">🏆 {"Official final ranking"}: #{recap.officialRank}</p> : null}
          <p className="theme-secondary-text mt-4 text-xs leading-5">
            {"Confirmed scores only. Team goals are not individual Golden Boot goals. Unfinished seasons have no official final placement."}
          </p>
          {recap.results.length ? <details className="mt-3 rounded-xl border border-[var(--theme-border)] p-3">
            <summary className="cursor-pointer font-semibold">{"Recent verified season matches"}</summary>
            <ul className="mt-3 space-y-2">
              {recap.results.map(match => <li key={match.id} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{match.tournamentName}</span>
                <span className="shrink-0 font-semibold">{match.outcome} · {new Date(match.confirmedAt).toLocaleDateString()}</span>
              </li>)}
            </ul>
          </details> : <p className="theme-secondary-text mt-3 text-sm">{"No verified matches in the eligible competitions this season."}</p>}
          <Link href="/career" className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--theme-primary)]">{"View full career"} →</Link>
        </FcPanel>)}
      </div>}
  </SecondaryFeaturePage>;
}
