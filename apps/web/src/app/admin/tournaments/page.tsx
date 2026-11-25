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
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const visibleTournaments = query ? tournaments.filter(tournament =>
    [tournament.name, tournament.code, tournament.leagueName, tournament.status].some(value => value.toLocaleLowerCase().includes(query)),
  ) : tournaments;
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
        <section className="space-y-4" aria-label="Manage tournaments">
          <FcPanel className="p-4">
            <label className="theme-text grid gap-2 text-sm font-semibold">
              Find a tournament
              <input type="search" value={search} onChange={event => setSearch(event.target.value)}
                placeholder="Name, code, league or status" className="theme-input min-h-11 min-w-0 w-full rounded-xl border px-3 font-normal" />
            </label>
            <p role="status" className="theme-secondary-text mt-2 text-xs">{visibleTournaments.length} of {tournaments.length} tournaments</p>
          </FcPanel>
          {visibleTournaments.length === 0 ? <FcEmptyState title="No matching tournaments" description="Try another name, code, league or status." /> : null}
          <div className="grid gap-4 lg:grid-cols-2">
          {visibleTournaments.map(
            (
              tournament,
            ) => (
              <FcPanel
                key={
                  tournament.id
                }
                className="p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="theme-text-link text-xs font-semibold uppercase tracking-wide [overflow-wrap:anywhere]">
                      {
                        tournament.leagueName
                      }
                    </p>

                    <h2 className="theme-text mt-2 text-xl font-semibold [overflow-wrap:anywhere]">
                      {
                        tournament.name
                      }
                    </h2>

                    <p className="theme-secondary-text mt-1 font-mono text-xs [overflow-wrap:anywhere]">
                      {
                        tournament.code
                      }
                    </p>

                    <p className="theme-secondary-text mt-2 text-xs tabular-nums">
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
                    className="theme-primary-button inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
                  >
                    Overview
                  </Link>

                  {(tournament.canManageSettings ?? true) ? <Link
                    href={
                      `/tournaments/${tournament.id}/settings`
                    }
                    className="theme-secondary-button inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold"
                  >
                    Settings
                  </Link> : null}

                  <Link
                    href={
                      `/tournaments/${tournament.id}/teams`
                    }
                    className="theme-secondary-button inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold"
                  >
                    Teams
                  </Link>
                </div>
              </FcPanel>
            ),
          )}
          </div>
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
