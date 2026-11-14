'use client';
import { registerAppRefresh } from '@/lib/app-refresh';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { loadFixtureFeed, hydrateFixtureFeed } from '@/lib/fixture-feed';
import { FcCrest, FcEmptyState, FcErrorState, FcLoadingScreen, FcPageHeader, FcStatusBadge, competitionLabel } from '@/components/fc/fc-ui';
import { useEffect, useState } from 'react';
import { FcIcon } from '@/components/fc/fc-icons';
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
        <FcPageHeader title="Match Center" icon="football" subtitle="Find your matches, submit scores and follow verified results." />

        {error && <FcErrorState message={error} onRetry={() => setRetry(value => value + 1)} />}
        {!matches.length && !error ? (
          <FcEmptyState title="No matches yet" description="Matches will appear here when fixtures are published." icon="fixtures"
            actionLabel="Browse fixtures" actionHref="/fixtures" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {matches.slice(0, renderLimit).map(fixture => {
              const home = entryName(fixture.home);
              const away = entryName(fixture.away);
              return <Link key={fixture.id} href={'/matches/' + fixture.match!.id} className="fc-arena-card">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="theme-text text-sm font-semibold">{fixture.tournamentName}</p>
                    <p className="theme-secondary-text mt-0.5 text-xs">{fixture.leagueName} · {fixture.roundName}</p>
                  </div>
                  {fixture.match?.status && <FcStatusBadge label={competitionLabel(fixture.match.status)} tone={fixture.match.status === 'LIVE' ? 'emerald' : 'slate'} />}
                </div>
                <div className="fc-match-list-score my-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-center">
                  <div className="grid min-w-0 justify-items-center gap-1 text-sm font-semibold">
                    <FcCrest name={home} size="sm" /><span>{home}</span>
                  </div>
                  <span className="theme-secondary-text text-xs font-semibold">vs</span>
                  <div className="grid min-w-0 justify-items-center gap-1 text-sm font-semibold">
                    <FcCrest name={away} size="sm" /><span>{away}</span>
                  </div>
                </div>
                <div className="theme-secondary-text flex items-center justify-between gap-2 border-t border-[var(--theme-border)] pt-3 text-xs">
                  <span>{fixture.match?.matchCode || 'Match'}</span>
                  <span className="flex items-center gap-1 font-semibold">Open match <FcIcon name="chevronRight" size={15} /></span>
                </div>
              </Link>;
            })}
          </div>
        )}
        {matches.length > renderLimit ? <button type="button" onClick={() => setRenderLimit(limit => limit + 40)} className="theme-secondary-button min-h-11 w-full rounded-xl border px-4 py-3 font-semibold">Show more matches ({matches.length - renderLimit} remaining)</button> : null}
      </div>
    </AppShell>
  );
}
