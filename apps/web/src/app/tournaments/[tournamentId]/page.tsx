"use client";
import { useRouteLeague } from '@/lib/active-league';
import { TournamentRegistrationSummary } from '@/components/tournaments/registration-summary';

import { useRecoverableLoad } from '@/lib/use-recoverable-load';

import { TournamentFormatOverview } from '@/components/tournaments/tournament-format-overview';
import { LeaguePlayoffSetup } from '@/components/tournaments/league-playoff-setup';
import { PlayerProgress } from "@/components/tournaments/player-progress";
import { confirmNamedDeletion } from "@/components/fc/confirmation-provider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app/app-shell";

import { PremiumHero, PremiumMatch } from "@/components/fc/premium-ui";

import {
  competitionLabel,
  FcCrest,
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcNotice,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from "@/components/fc/fc-ui";

import { TournamentNavigation } from "@/components/tournaments/tournament-navigation";
import { TournamentFixtureStart } from '@/components/tournaments/tournament-fixture-start';
import type { EntryLimitTournament } from '@/components/tournaments/tournament-entry-limit';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from "@/lib/auth-client";

interface Tournament extends EntryLimitTournament {
  id: string;
  leagueId: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  description: string | null;
  mode: string;
  format: string;
  competitionFormat?: string;
  groupMode?: string;
  playoffSource?: string | null;
  playoffQualifiersTotal?: number | null;
  qualifiersPerGroup?: number | null;
  playoffFormat?: string | null;
  status: string;
  registrationMode: string;
  visibility: string;
  maxEntries: number;
  approvedEntries: number;
  canManageParticipants?: boolean;
  pendingEntries?: number;
  registeredEntries?: number;
  startAt: string | null;
  endAt?: string | null;
  isLeagueAdmin: boolean;
  canManageSettings?: boolean;
  canManageFixtures?: boolean;

  league: {
    id: string;
    name: string;
    code: string;
  };
}

interface Entry {
  entryName: string | null;

  members: Array<{
    id: string;
    fullName: string;
    inGameName: string | null;
  }>;
}

interface Fixture {
  id: string;
  roundName: string;
  status: string;
  scheduledAt: string | null;
  home: Entry | null;
  away: Entry | null;

  match: {
    id: string;
    status: string;
  } | null;
}

interface Group {
  id: string;
}

function entryName(entry: Entry | null) {
  return (
    entry?.entryName ||
    entry?.members[0]?.inGameName ||
    entry?.members[0]?.fullName ||
    "TBD"
  );
}

export default function TournamentOverviewPage() {
  const { tournamentId } = useParams<{
    tournamentId: string;
  }>();

  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [tournament, setTournament] = useState<Tournament | null>(null);

  const [fixtures, setFixtures] = useState<Fixture[]>([]);

  const [groups, setGroups] = useState<Group[]>([]);

  const [deletingTournament, setDeletingTournament] = useState(false);

  const [deleteError, setDeleteError] = useState("");

  const [supportError, setSupportError] = useState('');
  useRouteLeague(user?.id, tournament?.id === tournamentId ? tournament.leagueId : null);

  const initialLoad = useRecoverableLoad(async signal => {
    const [current, response] = await Promise.all([getCurrentUser({ signal }), authenticatedRequest<any>(`/tournaments/${tournamentId}`, { signal })]);
    if (signal.aborted) return;
    setUser(current); setTournament(response.data.tournament);
    const [schedule, sections] = await Promise.allSettled([
      authenticatedRequest<any>(`/tournaments/${tournamentId}/fixtures`, { signal }),
      authenticatedRequest<any>(`/tournaments/${tournamentId}/groups`, { signal }),
    ]);
    if (signal.aborted) return;
    if (schedule.status === 'fulfilled') setFixtures(schedule.value.data.fixtures);
    if (sections.status === 'fulfilled') setGroups(sections.value.data.groups);
    setSupportError(schedule.status === 'rejected' || sections.status === 'rejected' ? 'Some fixture or group details could not refresh. Registration counts remain available.' : '');
  }, tournamentId);

  const nextFixture = useMemo(
    () =>
      [...fixtures]
        .filter((fixture) => {
          const status = fixture.match?.status || fixture.status;

          return !["COMPLETED", "CANCELLED"].includes(status) && [fixture.home, fixture.away].some(entry => entry?.members.some(member => member.id === user?.id));
        })
        .sort((first, second) => {
          if (!first.scheduledAt && !second.scheduledAt) {
            return 0;
          }

          if (!first.scheduledAt) {
            return 1;
          }

          if (!second.scheduledAt) {
            return -1;
          }

          return (
            new Date(first.scheduledAt).getTime() -
            new Date(second.scheduledAt).getTime()
          );
        })[0] ?? null,
    [fixtures, user],
  );

  async function deleteTournament() {
    if (!tournament || !(tournament.canManageSettings ?? tournament.isLeagueAdmin) || deletingTournament) {
      return;
    }

    const confirmation = await confirmNamedDeletion('Tournament', tournament.name);

    if (confirmation === null) {
      return;
    }

    if (confirmation.trim() !== tournament.name.trim()) {
      setDeleteError("Tournament name confirmation does not match.");

      return;
    }

    setDeletingTournament(true);

    setDeleteError("");

    try {
      await authenticatedRequest(`/tournaments/${tournamentId}`, {
        method: "DELETE",

        body: JSON.stringify({
          confirmName: confirmation,
        }),
      });

      router.replace("/tournaments");

      router.refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Unable to delete Tournament.",
      );
    } finally {
      setDeletingTournament(false);
    }
  }

  if (initialLoad.error) return <AppShell><FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} /></AppShell>;
  if (!user || !tournament || tournament.id !== tournamentId) {
    return <FcLoadingScreen label="Loading Tournament Overview..." />;
  }

  const progress =
    tournament.maxEntries > 0
      ? Math.min(
          100,
          (tournament.approvedEntries / tournament.maxEntries) * 100,
        )
      : 0;
  const duoRegistrationOpen = tournament.mode === 'DUO' &&
    tournament.status === 'REGISTRATION_OPEN' && tournament.registrationMode !== 'ADMIN_ONLY';
  const canConvertToLeaguePlayoffs = !supportError
    && groups.length === 0
    && fixtures.some(fixture => fixture !== null)
    && ['LEAGUE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN'].includes(tournament.competitionFormat ?? '')
    && ['DRAFT', 'REGISTRATION_CLOSED', 'ACTIVE'].includes(tournament.status)
    && Boolean(tournament.canManageSettings && tournament.canManageFixtures);

  const completedFixtures = fixtures.filter(fixture => fixture.status === 'COMPLETED' && fixture.match?.status === 'COMPLETED').length;

  return (
    <AppShell playerName={user.player?.identity?.inGameName}>
      <div className="premium-page premium-tournament-hub">
        <Link href="/tournaments" className="premium-quiet">← Tournaments</Link>
        <PremiumHero
          eyebrow={tournament.league.name}
          title={tournament.name}
          description={tournament.description || "A competition worth winning."}
          crest={tournament.name}
          imageUrl={tournament.logoUrl}
          action={
            <Link
              className="theme-primary-button premium-button"
              href={
                tournament.status === "COMPLETED"
                  ? `/tournaments/${tournamentId}/report`
                  : tournament.status === "DRAFT" && tournament.isLeagueAdmin
                    ? `/tournaments/${tournamentId}/wizard/setup`
                    : `/tournaments/${tournamentId}/${duoRegistrationOpen ? 'registration' : 'fixtures'}`
              }
            >
              {
                tournament.status === "COMPLETED"
                  ? "View Full Report"
                  : tournament.status === "DRAFT" && tournament.isLeagueAdmin
                    ? "Continue Setup"
                    : duoRegistrationOpen ? "Duo Registration" : "Open Fixtures"
              } →
            </Link>
          }
        ><div className="premium-hero-tags"><span>{competitionLabel(tournament.status)}</span><span>{tournament.competitionFormat === 'GROUP_STAGE_KNOCKOUT' && groups.length === 0 && tournament.playoffSource === 'OVERALL_STANDINGS' ? 'League + Playoffs' : competitionLabel(tournament.competitionFormat || tournament.format)}</span><span>{tournament.mode}</span><span>{tournament.registeredEntries ?? tournament.approvedEntries} registered · {tournament.pendingEntries ?? 0} pending</span>{tournament.startAt ? <span>{new Date(tournament.startAt).toLocaleDateString()}</span> : null}</div></PremiumHero>

        <TournamentNavigation tournamentId={tournamentId} />
        <TournamentRegistrationSummary tournament={tournament} />
        {supportError ? <div role="status" className="theme-panel rounded-xl border p-4 text-sm">{supportError} <button type="button" className="font-bold underline" onClick={initialLoad.retry}>Retry details</button></div> : null}
        <TournamentFormatOverview
          tournament={tournament}
          groupCount={supportError ? null : groups.length}
          tournamentId={tournamentId}
        />
        {canConvertToLeaguePlayoffs ? (
          <LeaguePlayoffSetup
            tournamentId={tournamentId}
            tournamentName={tournament.name}
            approvedEntries={tournament.approvedEntries}
            onSaved={async () => {
              const refreshed = await authenticatedRequest<{ data: { tournament: Tournament } }>(`/tournaments/${tournamentId}`);
              setTournament(refreshed.data.tournament);
            }}
          />
        ) : null}
        <PlayerProgress tournamentId={tournamentId} />

        <FcNotice tone="error">{deleteError}</FcNotice>

        <details className="theme-panel rounded-2xl border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-bold text-slate-300">Competition tools · Poster, registration, team management</summary>
        <FcPanel className="premium-competition-tools overflow-hidden">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <FcCrest
                  name={tournament.name}
                  imageUrl={tournament.logoUrl}
                  size="lg"
                />

                <div>
                  <p className="font-mono text-xs font-black text-sky-400">
                    {tournament.code}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <FcStatusBadge
                      label={competitionLabel(
                        tournament.competitionFormat || tournament.format,
                      )}
                      tone="cyan"
                    />

                    <FcStatusBadge label={tournament.mode} tone="slate" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {tournament.visibility === "PUBLIC" ? (
                  <Link
                    href={"/public/tournaments/" + tournament.code}
                    target="_blank"
                    className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.04] px-5 py-3 text-sm font-black text-emerald-300"
                  >
                    Public Page ↗
                  </Link>
                ) : null}

                <Link
                  href={`/tournaments/${tournamentId}/poster`}
                  className="rounded-xl border border-amber-400/25 bg-amber-400/[0.04] px-5 py-3 text-sm font-black text-amber-300"
                >
                  Auto Poster
                </Link>
                <Link
                  href={`/tournaments/${tournamentId}/teams`}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300"
                >
                  Manage Teams
                </Link>

                <Link
                  href={`/tournaments/${tournamentId}/registration`}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300"
                >
                  Registration
                </Link>

                {(tournament.canManageSettings ?? tournament.isLeagueAdmin) ? (
                  <button
                    type="button"
                    disabled={deletingTournament}
                    onClick={() => void deleteTournament()}
                    className="rounded-xl border border-red-400/30 bg-red-400/[0.04] px-5 py-3 text-sm font-black text-red-300 transition hover:bg-red-400/[0.08] disabled:opacity-40"
                  >
                    {deletingTournament ? "Deleting..." : "Delete Tournament"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-xs font-black text-slate-500">
                <span>Approved Entry Progress</span>

                <span>
                  {tournament.approvedEntries}/{tournament.maxEntries}
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="theme-progress-bar h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </FcPanel>
        </details>

        <section className="premium-metrics" aria-label="Competition progress">
          <FcStatCard
            label="Registered Teams"
            value={tournament.registeredEntries ?? tournament.approvedEntries}
            detail={`${tournament.approvedEntries} approved · ${tournament.pendingEntries ?? 0} pending`}
          />
          <FcStatCard
            label="Completed Fixtures"
            value={supportError ? "—" : completedFixtures}
            detail={supportError ? "Fixture progress unavailable" : `of ${fixtures.length} scheduled fixtures`}
            tone="emerald"
          />
        </section>

        <TournamentFixtureStart tournament={tournament} />

        {nextFixture ? (
          <PremiumMatch home={entryName(nextFixture.home)} away={entryName(nextFixture.away)} label={`Next Match · ${nextFixture.roundName}`} status={<FcStatusBadge label={nextFixture.match?.status || nextFixture.status} />} href={nextFixture.match?.id ? `/matches/${nextFixture.match.id}` : `/tournaments/${tournamentId}/fixtures`}>
            <span>{nextFixture.scheduledAt ? new Date(nextFixture.scheduledAt).toLocaleString() : "Schedule pending"}</span>
          </PremiumMatch>
        ) : tournament.status !== "COMPLETED" ? (
          <FcEmptyState
            title="No upcoming match"
            description="Open Fixtures to review the Tournament schedule or generate matches when permitted."
            actionLabel="Open Fixtures"
            actionHref={`/tournaments/${tournamentId}/fixtures`}
          />
        )}


      </div>
    </AppShell>
  );
}
