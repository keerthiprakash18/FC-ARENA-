'use client';

import { QualificationLegend } from '@/components/tournaments/tournament-format-guide';
import type { TournamentFormatDescription, QualificationBand } from '@/lib/tournament-format-guide';
import { ApiError } from "@/lib/api";
import Link from 'next/link';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import { AppShell } from '@/components/app/app-shell';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';
import { FcCrest, FcErrorState, FcLoadingScreen } from '@/components/fc/fc-ui';
import { PremiumHero } from '@/components/fc/premium-ui';
import { CompactStandingsTable } from '@/components/tournaments/compact-standings-table';


interface Standing {
  position: number;
  registrationId: string;
  entryName: string;
  entryLogoUrl: string | null;

  played: number;
  wins: number;
  draws: number;
  losses: number;

  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;

  points: number;
  form: string;
}


interface Statistic {
  matches: number;
  wins: number;
  draws: number;
  losses: number;

  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;

  form: string;
}



interface TournamentSummary {
  name: string;
  mode?: string;
  status: string;
  competitionFormat: string;
  formatGuide?: TournamentFormatDescription | null;
  legType: string;
}

interface GroupEntry {
  id: string;
  entryName: string | null;
  entryLogoUrl?: string | null;

  members: Array<{
    fullName: string;
    inGameName: string | null;
  }>;
}


interface TournamentGroup {
  id: string;
  name: string;
  position: number;
  entries: GroupEntry[];
}


function entryDisplayName(
  entry: GroupEntry,
) {
  if (entry.entryName) {
    return entry.entryName;
  }

  return (
    entry.members[0]?.inGameName ||
    entry.members[0]?.fullName ||
    'Tournament Entry'
  );
}


function StandingTable({
  title,
  entries,
  standings,
  eyebrow = 'Official Tournament Standings',
  bands = [],
}: {
  title: string;
  entries: GroupEntry[];
  standings: Standing[];
  eyebrow?: string;
  bands?: QualificationBand[];
}) {
  const lookup =
    new Map(
      standings.map(
        (standing) => [
          standing.registrationId,
          standing,
        ],
      ),
    );

  const rows =
    entries
      .map(
        (entry) => {
          const existing =
            lookup.get(
              entry.id,
            );

          if (existing) {
            return {
              ...existing,

              entryLogoUrl: existing.entryLogoUrl ?? entry.entryLogoUrl ?? null,

              entryName:
                existing.entryName ||
                entryDisplayName(
                  entry,
                ),
            };
          }

          return {
            position: 0,
            registrationId:
              entry.id,

            entryName:
              entryDisplayName(
                entry,
              ),

            entryLogoUrl:
              entry.entryLogoUrl ??
              null,

            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,

            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,

            points: 0,
            form: '',
          };
        },
      )
      .sort(
        (a, b) => (a.position || Number.MAX_SAFE_INTEGER) - (b.position || Number.MAX_SAFE_INTEGER),
      )
      .map(
        (
          row,
          index,
        ) => ({
          ...row,
          position:
            index + 1,
        }),
      );

  return (
    <section className="premium-standings-table overflow-hidden rounded-[26px] border border-white/10 bg-[#0a1018]">
      <div className="premium-standings-group-header flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
            {eyebrow}
          </p>

          <h2 className="mt-1 text-xl font-black">
            {title}
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-400">
            Official standings · sorted by points (PTS). Win 3 · Draw 1 · Loss 0. Goal difference breaks ties.
          </p>
        </div>

        <span className="rounded-full bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-300">
          {entries.length}{' '}
          Entries
        </span>
      </div>

      <QualificationLegend bands={bands} />
      <CompactStandingsTable label={`${title} standings`} qualificationBands={bands} rows={rows.map(row => ({
        ...row,
        logoUrl: row.entryLogoUrl,
      }))} />
      <div className="hidden overflow-x-auto sm:block" tabIndex={0} role="region" aria-label={`${title} detailed standings`}>
        <table className="w-full min-w-[850px] text-sm">
          <caption className="sr-only">{title} standings — played, wins, draws, losses, goals and points</caption>
          <thead className="border-b border-white/10 bg-white/[0.025] text-xs uppercase text-slate-500">
            <tr>
              <th className="p-4 text-left">
                #
              </th>

              <th className="p-4 text-left">
                Entry
              </th>

              <th className="p-4">
                P
              </th>

              <th className="p-4">
                W
              </th>

              <th className="p-4">
                D
              </th>

              <th className="p-4">
                L
              </th>

              <th className="p-4">
                GF
              </th>

              <th className="p-4">
                GA
              </th>

              <th className="p-4" title="Goal difference = goals for minus goals against" aria-label="Goal difference">
                GD
              </th>

              <th className="p-4 bg-sky-400/[0.10] text-sky-200" title="Points: win 3, draw 1, loss 0" aria-label="Points">
                PTS
              </th>

              <th className="p-4">
                FORM
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (row) => (
                <tr
                  key={
                    row.registrationId
                  }
                  className="border-b border-white/5 text-center last:border-0"
                >
                  <td className="p-4 text-left">
                    <span
                      title={bands.find(band => row.position >= band.from && row.position <= band.to)?.label}
                      data-qualification={bands.find(band => row.position >= band.from && row.position <= band.to)?.tone}
                      className={`inline-grid h-8 w-8 place-items-center rounded-xl font-black ${bands.some(band => row.position >= band.from && row.position <= band.to) ? 'fc-qualification-rank' : 'bg-white/[0.03] text-slate-500'}`}
                    >
                      {
                        row.position
                      }
                    </span>
                  </td>

                  <td className="p-4 text-left font-black"><div className="flex items-center gap-3"><FcCrest name={row.entryName} imageUrl={row.entryLogoUrl ?? undefined} size="sm" />
                    {
                      row.entryName
                    }
                  </div></td>

                  <td className="p-4">
                    {
                      row.played
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.wins
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.draws
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.losses
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.goalsFor
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.goalsAgainst
                    }
                  </td>

                  <td className="p-4 font-bold">
                    {row.goalDifference >
                    0
                      ? '+'
                      : ''}

                    {
                      row.goalDifference
                    }
                  </td>

                  <td className="p-4 bg-sky-400/[0.08] text-xl font-black tabular-nums text-sky-200" aria-label={`${row.points} points`}>
                    {
                      row.points
                    }
                  </td>

                  <td className="p-4 font-black tracking-widest">
                    {row.form ||
                      '—'}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


export default function StandingsPage() {
  const params =
    useParams<{
      tournamentId: string;
    }>();

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
    tournament,
    setTournament,
  ] =
    useState<TournamentSummary>({
      name: '',
      status: '',
      competitionFormat:
        'LEAGUE_ROUND_ROBIN',
      legType:
        'SINGLE_LEG',
    });

  const [
    standings,
    setStandings,
  ] =
    useState<Standing[]>(
      [],
    );

  const [
    groups,
    setGroups,
  ] =
    useState<TournamentGroup[]>(
      [],
    );

  const [
    statistic,
    setStatistic,
  ] =
    useState<Statistic | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(
          current,
        );

        const [
          table,
          groupData,
          stats,
        ] =
          await Promise.all([
            authenticatedRequest<{
              success: true;

              data: {
                tournament:
                  TournamentSummary;

                standings:
                  Standing[];
              };

              error: null;
            }>(
              `/tournaments/${params.tournamentId}/standings`,
            ),

            authenticatedRequest<{
              success: true;

              data: {
                groups:
                  TournamentGroup[];
              };

              error: null;
            }>(
              `/tournaments/${params.tournamentId}/groups`,
            ),

            authenticatedRequest<{
              success: true;

              data: {
                statistic:
                  Statistic | null;
              };

              error: null;
            }>(
              `/tournaments/${params.tournamentId}/my-statistics`,
            ),
          ]);

        setTournament(
          table.data
            .tournament,
        );

        setStandings(
          table.data
            .standings,
        );

        setGroups(
          groupData.data
            .groups,
        );

        setStatistic(
          stats.data
            .statistic,
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setLoadError("Unable to load standings. Please retry.");
      } finally {
        setLoading(
          false,
        );
      }
    }

    void load();
  }, [
    params.tournamentId,
    router,
  ]);


  if(loadError) return <AppShell><FcErrorState message={loadError} onRetry={() => window.location.reload()} /></AppShell>;
  if (
    !user ||
    loading
  ) {
    return (
      <FcLoadingScreen label="Loading Standings..." />
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
      <div className="premium-page">
        <Link
          href={`/tournaments/${params.tournamentId}`}
          scroll
          className="theme-text-link min-h-11 text-sm font-semibold"
        >
          ← Back to
          Tournament
        </Link>

        <PremiumHero eyebrow={tournament.name} title="Standings" description="Official competition standings and your own match statistics, updated from confirmed results." />

        {groups.length > 0 && tournament.formatGuide?.qualification.source === 'OVERALL_STANDINGS' && standings.length > 0 ? (
          <StandingTable title="Overall qualification table" eyebrow="Official Tournament Standings" bands={tournament.formatGuide.qualification.bands}
            entries={standings.map(row => ({ id: row.registrationId, entryName: row.entryName, entryLogoUrl: row.entryLogoUrl, members: [] }))} standings={standings} />
        ) : null}
        {groups.length > 0 ? (
          <div className="space-y-6">
            {groups
              .sort(
                (
                  a,
                  b,
                ) =>
                  a.position -
                  b.position,
              )
              .map(
                (
                  group,
                ) => (
                  <StandingTable
                    key={
                      group.id
                    }
                    bands={tournament.formatGuide?.qualification.source === 'GROUP_QUALIFIERS' ? tournament.formatGuide.qualification.bands : []}
                    title={
                      group.name
                    }
                    entries={
                      group.entries
                    }
                    standings={
                      standings
                    }
                  />
                ),
              )}
          </div>
        ) : standings.length > 0 ? (
          <StandingTable
            title="Overall Standings"
            bands={tournament.formatGuide?.qualification.source === 'OVERALL_STANDINGS' ? tournament.formatGuide.qualification.bands : []}
            eyebrow="Official Tournament Standings"
            entries={
              standings.map(
                (standing) => ({
                  id:
                    standing.registrationId,
                  entryName:
                    standing.entryName,
                  entryLogoUrl:
                    standing.entryLogoUrl,
                  members: [],
                }),
              )
            }
            standings={
              standings
            }
          />
        ) : (
          <section className="rounded-[24px] border border-dashed border-white/10 p-10 text-center">
            <p className="font-black text-slate-300">
              Standings will appear after confirmed results.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Play and confirm tournament fixtures to populate the overall table.
            </p>
          </section>
        )}

        {/** Personal metrics are secondary to the official points table. */}
        {statistic ? (
          <details className="rounded-2xl border border-white/10 bg-[#0a1018] p-4" aria-label="Optional personal player statistics">
            <summary className="cursor-pointer text-sm font-bold text-slate-300">My Player Statistics (optional) — show details</summary>
          <section aria-labelledby="my-player-stats-heading" className="mt-4 space-y-3">
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-5 py-4">
              <p className="theme-text-link text-xs font-black uppercase tracking-[0.16em]">Player Performance</p>
              <h2 id="my-player-stats-heading" className="theme-text mt-1 text-xl font-black">My Player Statistics</h2>
              <p className="theme-secondary-text mt-2 max-w-3xl text-sm leading-6">
                {tournament.mode === 'DUO' || tournament.mode === 'TEAM'
                  ? 'These are your individual match statistics. Team totals in the official standings above may differ from your personal goals and GD.'
                  : 'These are your personal match statistics. The official standings above rank tournament entries.'}
              </p>
            </div>
            <div className="premium-metrics premium-standing-metrics" aria-label="Your personal competition statistics">
            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Matches
              </p>

              <p className="mt-2 text-3xl font-black">
                {
                  statistic.matches
                }
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Wins
              </p>

              <p className="mt-2 text-3xl font-black">
                {
                  statistic.wins
                }
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Goal Difference
              </p>

              <p className="mt-2 text-3xl font-black">
                {statistic.goalDifference >
                0
                  ? '+'
                  : ''}

                {
                  statistic.goalDifference
                }
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Form
              </p>

              <p className="mt-2 text-xl font-black">
                {statistic.form ||
                  '—'}
              </p>
            </article>
            </div>
          </section>
          </details>
        ) : null}



      </div>
    </AppShell>
  );
}
