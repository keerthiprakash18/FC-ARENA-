'use client';
import { TournamentRegistrationSummary, type RegistrationSummaryData } from '@/components/tournaments/registration-summary';

import Link from 'next/link';
import { useRecoverableLoad } from '@/lib/use-recoverable-load';
import { useState } from 'react';

import { AdminNavigation } from '@/components/admin/admin-navigation';
import {
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { authenticatedRequest } from '@/lib/auth-client';

interface Membership {
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

  league: {
    id: string;
    name: string;
  };
}

interface Tournament extends RegistrationSummaryData {
  id: string;
  name: string;
  code: string;
  status: string;
  approvedEntries: number;
  maxEntries: number;
}

interface AdminTournament
  extends Tournament {
  leagueName: string;
}

export default function AdminTournamentsPage() {
  const [
    tournaments,
    setTournaments,
  ] =
    useState<AdminTournament[]>(
      [],
    );

  const [loading, setLoading] = useState(true);
  const initialLoad = useRecoverableLoad(async signal => {
    setLoading(true);
    try {
      const leagues = await authenticatedRequest<{ data: { leagues: Membership[] } }>('/leagues/my', { signal });
      const groups = await Promise.all(leagues.data.leagues.filter(item => Boolean(item.adminRole)).map(async membership => {
        const response = await authenticatedRequest<{ data: { tournaments: Tournament[] } }>(`/leagues/${membership.league.id}/tournaments`, { signal });
        return response.data.tournaments.map(tournament => ({ ...tournament, leagueName: membership.league.name }));
      }));
      if (!signal.aborted) setTournaments(groups.flat());
    } finally { if (!signal.aborted) setLoading(false); }
  });

  return (
    <SecondaryFeaturePage
      eyebrow="Admin"
      title="Tournament Management"
      subtitle="Open a Tournament directly into its dedicated overview, teams, groups, fixtures or admin settings."
    >
      <AdminNavigation />

      {initialLoad.error ? <FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} /> : loading ? <FcLoadingScreen label="Loading admin tournaments..." embedded /> : tournaments.length === 0 ? (
        <FcEmptyState
          title="No admin Tournaments"
          description="Create a Tournament inside a League where you have admin access."
          actionLabel="Open Tournaments"
          actionHref="/tournaments"
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {tournaments.map(
            (
              tournament,
            ) => (
              <FcPanel
                key={
                  tournament.id
                }
                className="p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-400">
                      {
                        tournament.leagueName
                      }
                    </p>

                    <h2 className="mt-2 text-xl font-black">
                      {
                        tournament.name
                      }
                    </h2>

                    <p className="mt-1 font-mono text-[10px] text-slate-600">
                      {
                        tournament.code
                      }
                    </p>

                    <p className="mt-2 text-xs text-slate-600">
                      {
                        tournament.registeredEntries ?? tournament.approvedEntries + (tournament.pendingEntries ?? 0)
                      }
                      /
                      {
                        tournament.maxEntries
                      }{' '}
                      entries
                    </p>
                  </div>

                  <FcStatusBadge
                    label={
                      tournament.status
                    }
                    tone={
                      tournament.status ===
                      'DRAFT'
                        ? 'amber'
                        : tournament.status ===
                            'COMPLETED'
                          ? 'emerald'
                          : 'cyan'
                    }
                  />
                </div>

                <div className="mt-4"><TournamentRegistrationSummary tournament={tournament} /></div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={
                      `/tournaments/${tournament.id}`
                    }
                    className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
                  >
                    Overview
                  </Link>

                  {(tournament.canManageSettings ?? true) ? <Link
                    href={
                      `/tournaments/${tournament.id}/settings`
                    }
                    className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
                  >
                    Settings
                  </Link> : null}

                  <Link
                    href={
                      `/tournaments/${tournament.id}/teams`
                    }
                    className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
                  >
                    Teams
                  </Link>
                </div>
              </FcPanel>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
