'use client';

import Link from 'next/link';
import {
  useParams,
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
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';
import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface EntrySummary {
  registrationId: string;
  name: string;
  logoUrl: string | null;
  members: Array<{
    userId: string;
    name: string;
    playerCode: string | null;
    profileImageUrl: string | null;
  }>;
}

interface AwardWinner {
  userId: string;
  name: string;
  playerCode: string | null;
  profileImageUrl: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
}

interface TournamentSummary {
  version: number;
  tournament: {
    id: string;
    name: string;
    code: string;
    mode: string;
    format: string;
    competitionFormat: string;
    logoUrl: string | null;
    completedAt: string | null;
  };
  placements: {
    champion: EntrySummary | null;
    runnerUp: EntrySummary | null;
    thirdPlace: EntrySummary[];
  };
  awards: {
    goldenBoot: AwardWinner[];
    goldenGlove: AwardWinner[];
    playerOfTournament: AwardWinner[];
  };
  stats: {
    entries: number;
    completedMatches: number;
    totalGoals: number;
    averageGoalsPerMatch: number;
    highestScoringTeam: {
      entry: EntrySummary | null;
      goals: number;
    } | null;
    bestDefence: {
      entry: EntrySummary | null;
      goalsAgainst: number;
    } | null;
    biggestWin: {
      margin: number;
      roundName: string;
      home: EntrySummary | null;
      away: EntrySummary | null;
      homeScore: number;
      awayScore: number;
    } | null;
  };
}

interface SummaryResponse {
  available: boolean;
  tournament: {
    id: string;
    name: string;
    code: string;
    status: string;
    logoUrl: string | null;
  };
  summary: TournamentSummary | null;
  publishedAt: string | null;
  legacyDerived: boolean;
}

function PodiumCard({
  label,
  icon,
  entry,
  featured = false,
}: {
  label: string;
  icon: string;
  entry: EntrySummary | null;
  featured?: boolean;
}) {
  return (
    <FcPanel
      className={
        featured
          ? 'relative overflow-hidden border-amber-300/30 bg-amber-300/[0.045] p-6 text-center md:-translate-y-3'
          : 'relative overflow-hidden p-6 text-center'
      }
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-20" />
      <p className="text-4xl">{icon}</p>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <div className="mt-4 flex justify-center">
        <FcCrest
          name={entry?.name ?? label}
          imageUrl={entry?.logoUrl}
          size="lg"
        />
      </div>
      <h3 className={featured ? 'mt-4 text-2xl font-black text-amber-200' : 'mt-4 text-xl font-black'}>
        {entry?.name ?? 'Not awarded'}
      </h3>
      {entry?.members?.length ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {entry.members.map((member) => member.name).join(' • ')}
        </p>
      ) : null}
    </FcPanel>
  );
}

function AwardCard({
  icon,
  title,
  winners,
}: {
  icon: string;
  title: string;
  winners: AwardWinner[];
}) {
  return (
    <FcPanel className="relative overflow-hidden p-5">
      <div className="absolute -right-5 -top-6 text-8xl opacity-[0.045]">
        {icon}
      </div>
      <p className="text-3xl">{icon}</p>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
        {title}
      </p>
      {winners.length ? (
        <div className="mt-3 space-y-3">
          {winners.map((winner) => (
            <div key={winner.userId}>
              <p className="text-lg font-black">{winner.name}</p>
              <p className="mt-1 font-mono text-[10px] text-slate-600">
                {winner.playerCode || 'FC Arena Player'}
              </p>
              {winner.description ? (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {winner.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Not awarded for this tournament.</p>
      )}
    </FcPanel>
  );
}

export default function TournamentSummaryPage() {
  const { tournamentId } =
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
    data,
    setData,
  ] =
    useState<SummaryResponse | null>(
      null,
    );

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
              data: SummaryResponse;
              error: null;
            }>(
              `/tournaments/${tournamentId}/summary`,
            ),
          ]);

        if (!active) {
          return;
        }

        setUser(current);
        setData(response.data);
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load tournament summary.',
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [
    router,
    tournamentId,
  ]);

  if (
    !user ||
    !data
  ) {
    return (
      <FcLoadingScreen
        label={
          error ||
          'Loading Tournament Summary...'
        }
      />
    );
  }

  if (
    !data.available ||
    !data.summary
  ) {
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
            backHref={
              `/tournaments/${tournamentId}`
            }
            backLabel="Tournament Overview"
            eyebrow={
              data.tournament
                .name
            }
            title="Tournament Summary"
            subtitle="The official recap unlocks after the tournament is completed and verified."
          />

          <TournamentNavigation
            tournamentId={
              tournamentId
            }
          />

          <FcEmptyState
            title="Summary not published yet"
            description="Complete every required match, verify the results, then complete the tournament from Awards. FC Arena will lock the final podium, awards and competition statistics into this summary."
            actionLabel="Open Awards"
            actionHref={
              `/tournaments/${tournamentId}/achievements`
            }
          />
        </div>
      </AppShell>
    );
  }

  const summary =
    data.summary;

  const thirdPlace =
    summary.placements
      .thirdPlace;

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
          backHref={
            `/tournaments/${tournamentId}`
          }
          backLabel="Tournament Overview"
          eyebrow="Official Tournament Recap"
          title={
            summary.tournament
              .name
          }
          subtitle="Final placements, individual honours and verified competition statistics."
        />

        <TournamentNavigation
          tournamentId={
            tournamentId
          }
        />

        <section className="fc-stadium-surface relative overflow-hidden rounded-[30px] border border-amber-300/20 p-6 sm:p-8">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <FcStatusBadge
                  label="COMPLETED"
                  tone="emerald"
                />
                <FcStatusBadge
                  label={
                    summary.tournament
                      .competitionFormat
                  }
                  tone="cyan"
                />
                {data.legacyDerived ? (
                  <FcStatusBadge
                    label="LEGACY RECAP"
                    tone="slate"
                  />
                ) : null}
              </div>

              <p className="mt-7 text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">
                🏆 Champions
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
                {
                  summary.placements
                    .champion
                    ?.name ??
                  'Champion'
                }
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                {
                  summary.tournament
                    .completedAt
                    ? `Completed ${new Date(
                        summary.tournament.completedAt,
                      ).toLocaleDateString()}`
                    : 'Official FC Arena tournament summary'
                }
              </p>
            </div>

            <FcCrest
              name={
                summary.placements
                  .champion
                  ?.name ??
                summary.tournament
                  .name
              }
              imageUrl={
                summary.placements
                  .champion
                  ?.logoUrl ??
                summary.tournament
                  .logoUrl
              }
              size="lg"
            />
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Final Standings
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Tournament Podium
              </h2>
            </div>

            <Link
              href="/tournaments/history"
              className="text-sm font-black text-sky-300"
            >
              Tournament History →
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            <PodiumCard
              label="Runner-Up"
              icon="🥈"
              entry={
                summary.placements
                  .runnerUp
              }
            />

            <PodiumCard
              label="Champion"
              icon="🏆"
              featured
              entry={
                summary.placements
                  .champion
              }
            />

            <PodiumCard
              label={
                thirdPlace.length >
                1
                  ? 'Joint Third'
                  : 'Third Place'
              }
              icon="🥉"
              entry={
                thirdPlace[0] ??
                null
              }
            />
          </div>

          {thirdPlace.length >
          1 ? (
            <p className="mt-3 text-center text-xs text-slate-500">
              Joint third: {
                thirdPlace
                  .map(
                    (
                      entry,
                    ) =>
                      entry.name,
                  )
                  .join(' • ')
              }
            </p>
          ) : null}
        </section>

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Tournament Honours
          </p>
          <h2 className="mt-1 text-2xl font-black">
            Individual Awards
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <AwardCard
              icon="⚽"
              title="Golden Boot"
              winners={
                summary.awards
                  .goldenBoot
              }
            />
            <AwardCard
              icon="🧤"
              title="Golden Glove"
              winners={
                summary.awards
                  .goldenGlove
              }
            />
            <AwardCard
              icon="⭐"
              title="Player of the Tournament"
              winners={
                summary.awards
                  .playerOfTournament
              }
            />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Competition Numbers
          </p>
          <h2 className="mt-1 text-2xl font-black">
            Tournament Statistics
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FcStatCard
              label="Entries"
              value={
                summary.stats
                  .entries
              }
            />
            <FcStatCard
              label="Matches"
              value={
                summary.stats
                  .completedMatches
              }
              tone="emerald"
            />
            <FcStatCard
              label="Goals"
              value={
                summary.stats
                  .totalGoals
              }
              tone="amber"
            />
            <FcStatCard
              label="Goals / Match"
              value={
                summary.stats
                  .averageGoalsPerMatch
              }
              tone="slate"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
                Highest Scoring Team
              </p>
              <p className="mt-3 text-xl font-black">
                {
                  summary.stats
                    .highestScoringTeam
                    ?.entry?.name ??
                  '—'
                }
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {
                  summary.stats
                    .highestScoringTeam
                    ? `${summary.stats.highestScoringTeam.goals} goals`
                    : 'No verified data'
                }
              </p>
            </FcPanel>

            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                Best Defence
              </p>
              <p className="mt-3 text-xl font-black">
                {
                  summary.stats
                    .bestDefence
                    ?.entry?.name ??
                  '—'
                }
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {
                  summary.stats
                    .bestDefence
                    ? `${summary.stats.bestDefence.goalsAgainst} goals conceded`
                    : 'No verified data'
                }
              </p>
            </FcPanel>

            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Biggest Win
              </p>
              {summary.stats
                .biggestWin ? (
                <>
                  <p className="mt-3 text-xl font-black">
                    {
                      summary.stats
                        .biggestWin
                        .home?.name ??
                      'Home'
                    }{' '}
                    {
                      summary.stats
                        .biggestWin
                        .homeScore
                    }
                    {' – '}
                    {
                      summary.stats
                        .biggestWin
                        .awayScore
                    }{' '}
                    {
                      summary.stats
                        .biggestWin
                        .away?.name ??
                      'Away'
                    }
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {
                      summary.stats
                        .biggestWin
                        .roundName
                    }
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No verified data
                </p>
              )}
            </FcPanel>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
