'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { FcLoadingScreen, FcPanel } from '@/components/fc/fc-ui';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';

interface AnalyticsData {
  summary: {
    tournaments: number;
    completedTournaments: number;
    approvedEntries: number;
    fixtures: number;
    completedFixtures: number;
    awards: number;
  };
  tournaments: Array<{
    id: string;
    name: string;
    status: string;
    competitionFormat: string;
    approvedEntries: number;
    fixtures: number;
    completedFixtures: number;
    awards: number;
  }>;
}

export default function LeagueAnalyticsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        const response = await authenticatedRequest<{ data: AnalyticsData }>(
          `/leagues/${leagueId}/analytics/season`,
        );
        setAnalytics(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analytics could not be loaded.');
      }
    })();
  }, [leagueId]);

  if (!user || !analytics) {
    if (error) {
      return (
        <div className="grid min-h-screen place-items-center p-6">
          <FcPanel className="max-w-md p-6 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button type="button" onClick={() => router.back()} className="theme-secondary-button mt-4 rounded-xl px-4 py-2 text-sm font-bold">
              Go back
            </button>
          </FcPanel>
        </div>
      );
    }
    return <FcLoadingScreen label="Loading league analytics..." />;
  }

  const cards = [
    ['Tournaments', analytics.summary.tournaments],
    ['Completed', analytics.summary.completedTournaments],
    ['Approved entries', analytics.summary.approvedEntries],
    ['Verified fixtures', `${analytics.summary.completedFixtures}/${analytics.summary.fixtures}`],
    ['Awards', analytics.summary.awards],
  ];

  return (
    <AppShell playerName={user.player?.identity?.inGameName}>
      <div className="space-y-6">
        <BackHeader backHref={`/leagues/${leagueId}`} backLabel="League" eyebrow="Organizer view" title="Season analytics" subtitle="A verified-results summary across this League's tournaments." />
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(([label, value]) => (
            <FcPanel key={String(label)} className="p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-3 text-3xl font-black text-sky-300">{value}</p>
            </FcPanel>
          ))}
        </section>
        <FcPanel className="overflow-hidden p-0">
          <div className="border-b border-white/[0.07] p-5">
            <h2 className="text-xl font-black">Tournament summary</h2>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {analytics.tournaments.map((tournament) => (
              <div key={tournament.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-black">{tournament.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{tournament.competitionFormat.replaceAll('_', ' ')} · {tournament.status}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-right text-xs text-slate-400">
                  <span><strong className="block text-lg text-slate-100">{tournament.approvedEntries}</strong>entries</span>
                  <span><strong className="block text-lg text-slate-100">{tournament.completedFixtures}/{tournament.fixtures}</strong>fixtures</span>
                  <span><strong className="block text-lg text-slate-100">{tournament.awards}</strong>awards</span>
                </div>
              </div>
            ))}
          </div>
        </FcPanel>
      </div>
    </AppShell>
  );
}
