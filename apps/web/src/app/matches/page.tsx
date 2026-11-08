'use client';
import { registerAppRefresh } from '@/lib/app-refresh';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { loadFixtureFeed, hydrateFixtureFeed } from '@/lib/fixture-feed';
import { FcErrorState, FcLoadingScreen } from '@/components/fc/fc-ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface MyLeague {
  league: {
    id: string;
    name: string;
  };
}

interface Entry {
  entryName: string | null;
  members: Array<{
    fullName: string;
    inGameName: string | null;
  }>;
}

interface Fixture {
  id: string;
  roundName: string;
  status: string;
  home: Entry | null;
  away: Entry | null;
  match: {
    id: string;
    matchCode: string | null;
    status: string;
  } | null;
}

interface MatchItem extends Fixture {
  tournamentName: string;
  leagueName: string;
}

function entryName(entry: Entry | null) {
  if (!entry) return 'TBD';

  return (
    entry.entryName ||
    entry.members[0]?.inGameName ||
    entry.members[0]?.fullName ||
    'Entry'
  );
}

export default function MatchesPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [renderLimit, setRenderLimit] = useState(40);
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [matches, setMatches] =
    useState<MatchItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let active = true, loaded = false;
    const controller = new AbortController();
    async function load() {
      if (!loaded) setLoading(true); setError('');
      try {
        const [currentUser, leagueResult] = await Promise.all([
          getCurrentUser({ signal: controller.signal }),
          authenticatedRequest<{ data: { leagues: MyLeague[] } }>('/leagues/my', { signal: controller.signal }),
        ]);
        if (!active) return false;
        setUser(currentUser);
        const feeds = await Promise.allSettled(leagueResult.data.leagues.map(async membership => {
          const feed = await loadFixtureFeed(membership.league.id, undefined, controller.signal);
          return feed.unchanged ? [] : hydrateFixtureFeed(feed).filter(fixture => fixture.match !== null);
        }));
        if (!active) return false;
        const denied = feeds.find(result => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401);
        if (denied) { router.replace('/login'); return false; }
        if (!loaded || feeds.every(result => result.status === 'fulfilled')) setMatches(feeds.flatMap(result => result.status === 'fulfilled' ? result.value : []));
        if (feeds.some(result => result.status === 'rejected')) setError('Some league schedules could not be loaded. Retry to see every match.');
        loaded = true;
        return feeds.every(result => result.status === 'fulfilled');
      } catch (err) {
        if (!active) return false;
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(err instanceof ApiError ? err.message : 'Unable to load matches. Please retry.');
        return false;
      } finally { if (active) setLoading(false); }
    }
    const unsubscribe = registerAppRefresh(load);
    void load();
    const recover = () => { if (!loaded) setRetry(value => value + 1); };
    window.addEventListener('online', recover);
    return () => { active = false; controller.abort(); unsubscribe(); window.removeEventListener('online', recover); };
  }, [router, retry]);

  if (error && !user) return <AppShell><FcErrorState message={error} onRetry={() => setRetry(value => value + 1)} /></AppShell>;
  if (!user || loading) return <AppShell currentUser={user ?? undefined}><FcLoadingScreen label="Loading matches..." embedded /></AppShell>;

  return (
    <AppShell
      currentUser={user}
      playerName={
        user.player?.identity?.inGameName
      }
    >
      <div className="space-y-7">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            Competition
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-5xl">
            Match Center
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Open matches, submit results and follow
            match status.
          </p>
        </section>

        {error ? <FcErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : null}
        {matches.length === 0 && !error ? (
          <div className="rounded-[24px] border border-dashed border-white/10 p-10 text-center text-slate-500">
            No matches available yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {matches.slice(0, renderLimit).map((fixture) => (
              <Link
                key={fixture.id}
                href={`/matches/${fixture.match!.id}`}
                scroll
                className="rounded-[24px] border border-white/10 bg-[#0a1018] p-5 transition hover:border-sky-400/30"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                  {fixture.tournamentName}
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  {fixture.leagueName} ·{' '}
                  {fixture.roundName}
                </p>

                <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <p className="text-right font-black">
                    {entryName(fixture.home)}
                  </p>

                  <span className="text-xs font-black text-sky-400">
                    VS
                  </span>

                  <p className="font-black">
                    {entryName(fixture.away)}
                  </p>
                </div>

                <div className="mt-5 flex justify-between text-xs">
                  <span className="text-slate-600">
                    {fixture.match?.matchCode ||
                      'MATCH'}
                  </span>

                  <span className="font-black text-slate-400">
                    {fixture.match?.status.replaceAll(
                      '_',
                      ' ',
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {matches.length > renderLimit ? <button type="button" onClick={() => setRenderLimit(limit => limit + 40)} className="theme-secondary-button min-h-11 w-full rounded-xl border px-4 py-3 font-semibold">Show more matches ({matches.length - renderLimit} remaining)</button> : null}
      </div>
    </AppShell>
  );
}
