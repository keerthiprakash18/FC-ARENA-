"use client";

import { PlayerProgress } from "@/components/tournaments/player-progress";
import { confirmNamedDeletion } from "@/components/fc/confirmation-provider";
import { ApiError } from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from "@/lib/auth-client";

interface Tournament {
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
  status: string;
  visibility: string;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
  endAt?: string | null;
  isLeagueAdmin: boolean;

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

  const [loadError, setLoadError] = useState("");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);

  const [groups, setGroups] = useState<Group[]>([]);

  const [deletingTournament, setDeletingTournament] = useState(false);

  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [current, tournamentResponse, fixtureResponse, groupResponse] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(`/tournaments/${tournamentId}`),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/fixtures`,
            ).catch(() => ({
              data: {
                fixtures: [],
              },
            })),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/groups`,
            ).catch(() => ({
              data: {
                groups: [],
              },
            })),
          ]);

        setUser(current);

        setTournament(tournamentResponse.data.tournament);

        setFixtures(fixtureResponse.data.fixtures);

        setGroups(groupResponse.data.groups);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setLoadError("Unable to load this tournament. Please retry.");
      }
    })();
  }, [router, tournamentId]);

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
    if (!tournament || !tournament.isLeagueAdmin || deletingTournament) {
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

  if (loadError) return <AppShell><FcErrorState message={loadError} onRetry={() => window.location.reload()} /></AppShell>;
  if (!user || !tournament) {
    return <FcLoadingScreen label="Loading Tournament Overview..." />;
  }

  const progress =
    tournament.maxEntries > 0
      ? Math.min(
          100,
          (tournament.approvedEntries / tournament.maxEntries) * 100,
        )
      : 0;

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
            <Link className="theme-primary-button premium-button" href={tournament.status === "DRAFT" && tournament.isLeagueAdmin ? `/tournaments/${tournamentId}/wizard/setup` : `/tournaments/${tournamentId}/fixtures`}>{tournament.status === "DRAFT" && tournament.isLeagueAdmin ? "Continue Setup" : "Open Fixtures"} →</Link>
          }
        ><div className="premium-hero-tags"><span>{competitionLabel(tournament.status)}</span><span>{competitionLabel(tournament.competitionFormat || tournament.format)}</span><span>{tournament.mode}</span><span>{tournament.approvedEntries} / {tournament.maxEntries} entries</span>{tournament.startAt ? <span>{new Date(tournament.startAt).toLocaleDateString()}</span> : null}</div></PremiumHero>

        <TournamentNavigation tournamentId={tournamentId} />
        <PlayerProgress tournamentId={tournamentId} />

        <FcNotice tone="error">{deleteError}</FcNotice>

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

                {tournament.isLeagueAdmin ? (
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
                <span>Entry Progress</span>

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

        <section className="premium-metrics" aria-label="Tournament summary">
          <FcStatCard
            label="Teams"
            value={tournament.approvedEntries}
            detail={`Max ${tournament.maxEntries}`}
          />

          <FcStatCard
            label="Groups"
            value={groups.length}
            detail={
              tournament.groupMode
                ? competitionLabel(tournament.groupMode)
                : "Single table"
            }
            tone="amber"
          />

          <FcStatCard
            label="Fixtures"
            value={fixtures.length}
            detail="Tournament schedule"
            tone="emerald"
          />

          <FcStatCard
            label="Stage"
            value={competitionLabel(tournament.status)}
            detail="Current state"
            tone="slate"
          />
        </section>

        {nextFixture ? (
          <PremiumMatch home={entryName(nextFixture.home)} away={entryName(nextFixture.away)} label={`Next Match · ${nextFixture.roundName}`} status={<FcStatusBadge label={nextFixture.match?.status || nextFixture.status} />} href={nextFixture.match?.id ? `/matches/${nextFixture.match.id}` : `/tournaments/${tournamentId}/fixtures`}>
            <span>{nextFixture.scheduledAt ? new Date(nextFixture.scheduledAt).toLocaleString() : "Schedule pending"}</span>
          </PremiumMatch>
        ) : (
          <FcEmptyState
            title="No upcoming match"
            description="Open Fixtures to review the Tournament schedule or generate matches when permitted."
            actionLabel="Open Fixtures"
            actionHref={`/tournaments/${tournamentId}/fixtures`}
          />
        )}

        <section className="premium-hub-links" aria-label="Competition destinations">
          {[
            [
              "Teams",
              "Tournament entries and team management",
              `/tournaments/${tournamentId}/teams`,
            ],
            [
              "Groups",
              "Group structure and assignments",
              `/tournaments/${tournamentId}/groups`,
            ],
            [
              "Standings",
              "Live tables from confirmed results",
              `/tournaments/${tournamentId}/standings`,
            ],
            [
              "Bracket",
              "Knockout qualification and progression",
              `/tournaments/${tournamentId}/playoffs`,
            ],
          ].map(([title, description, href]) => (
            <Link
              key={title}
              href={href}
              className="premium-destination"
            >
              <span><strong>{title}</strong><span>{description}</span></span><span aria-hidden="true">→</span>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
