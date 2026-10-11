'use client';

import Link from 'next/link';
import {
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';
import {
  BackHeader,
} from '@/components/app/back-header';
import {
  FcCrest,
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface EntrySummary {
  registrationId: string;
  name: string;
  logoUrl: string | null;
}

interface SummarySnapshot {
  placements?: {
    champion?: EntrySummary | null;
    runnerUp?: EntrySummary | null;
    thirdPlace?: EntrySummary[];
  };
  awards?: {
    goldenBoot?: Array<{
      name: string;
    }>;
    goldenGlove?: Array<{
      name: string;
    }>;
    playerOfTournament?: Array<{
      name: string;
    }>;
  };
  stats?: {
    completedMatches?: number;
    totalGoals?: number;
  };
}

interface HistoryItem {
  tournament: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    mode: string;
    competitionFormat: string;
    completedAt: string | null;
    league: {
      id: string;
      name: string;
    };
  };
  summary: SummarySnapshot | null;
  publishedAt: string | null;
  legacyDerived: boolean;
}

export default function TournamentHistoryPage() {
  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    items,
    setItems,
  ] =
    useState<HistoryItem[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [
          current,
          response,
        ] =
          await Promise.all([
            getCurrentUser(),
            authenticatedRequest<{
              success: true;
              data: {
                summaries: HistoryItem[];
              };
              error: null;
            }>(
              '/tournament-summaries',
            ),
          ]);

        if (!active) {
          return;
        }

        setUser(current);
        setItems(
          response.data
            .summaries,
        );
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load tournament history.',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    router,
  ]);

  if (
    !user ||
    loading
  ) {
    return (
      <FcLoadingScreen
        label="Loading Tournament History..."
      />
    );
  }

  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <BackHeader
          backHref="/tournaments"
          backLabel="Tournaments"
          eyebrow="FC Arena Archive"
          title="Tournament History"
          subtitle="Completed competitions, champions and final tournament honours in one place."
        />

        {error ? (
          <FcPanel className="border-red-400/20 p-5 text-sm text-red-300">
            {error}
          </FcPanel>
        ) : null}

        {items.length ===
        0 ? (
          <FcEmptyState
            title="No completed tournaments yet"
            description="Completed tournament summaries will appear here automatically."
            actionLabel="Open Tournaments"
            actionHref="/tournaments"
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {items.map(
              (
                item,
              ) => {
                const champion =
                  item.summary
                    ?.placements
                    ?.champion;

                const runnerUp =
                  item.summary
                    ?.placements
                    ?.runnerUp;

                const goldenBoot =
                  item.summary
                    ?.awards
                    ?.goldenBoot?.[0]
                    ?.name;

                return (
                  <Link
                    key={
                      item.tournament
                        .id
                    }
                    href={
                      `/tournaments/${item.tournament.id}/summary`
                    }
                    className="group block"
                  >
                    <FcPanel className="h-full overflow-hidden transition duration-200 group-hover:-translate-y-0.5 group-hover:border-sky-400/25">
                      <div className="fc-stadium-surface border-b border-white/[0.07] p-5">
                        <div className="relative z-10 flex items-start justify-between gap-4">
                          <FcCrest
                            name={
                              champion
                                ?.name ??
                              item.tournament
                                .name
                            }
                            imageUrl={
                              champion
                                ?.logoUrl ??
                              item.tournament
                                .logoUrl
                            }
                            size="lg"
                          />

                          <FcStatusBadge
                            label="COMPLETED"
                            tone="emerald"
                          />
                        </div>

                        <p className="relative z-10 mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                          🏆 Champion
                        </p>

                        <h2 className="relative z-10 mt-1 text-2xl font-black">
                          {
                            champion
                              ?.name ??
                            'Open summary'
                          }
                        </h2>
                      </div>

                      <div className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-black">
                              {
                                item.tournament
                                  .name
                              }
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {
                                item.tournament
                                  .league
                                  .name
                              } · {
                                item.tournament
                                  .code
                              }
                            </p>
                          </div>

                          <p className="text-xs text-slate-600">
                            {
                              item.tournament
                                .completedAt
                                ? new Date(
                                    item.tournament.completedAt,
                                  ).toLocaleDateString()
                                : 'Completed'
                            }
                          </p>
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-white/[0.025] p-3">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                              Runner-Up
                            </p>
                            <p className="mt-1 truncate text-xs font-black">
                              {
                                runnerUp
                                  ?.name ??
                                '—'
                              }
                            </p>
                          </div>

                          <div className="rounded-xl bg-white/[0.025] p-3">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                              Golden Boot
                            </p>
                            <p className="mt-1 truncate text-xs font-black">
                              {
                                goldenBoot ??
                                '—'
                              }
                            </p>
                          </div>

                          <div className="rounded-xl bg-white/[0.025] p-3">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                              Goals
                            </p>
                            <p className="mt-1 truncate text-xs font-black">
                              {
                                item.summary
                                  ?.stats
                                  ?.totalGoals ??
                                '—'
                              }
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-500">
                            {
                              item.legacyDerived
                                ? 'Legacy tournament · recap generated on open'
                                : 'Official summary snapshot'
                            }
                          </span>
                          <span className="text-sm font-black text-sky-300">
                            View Summary →
                          </span>
                        </div>
                      </div>
                    </FcPanel>
                  </Link>
                );
              },
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
