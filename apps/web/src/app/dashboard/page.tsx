"use client";

import { PlayerOnboarding } from "@/components/fc/player-onboarding";
import { ApiError } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app/app-shell";

import type { FcIconName } from "@/components/fc/fc-icons";

import { FcIcon } from "@/components/fc/fc-icons";

import {
  FcCrest,
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from "@/components/fc/fc-ui";
import { AwardEmblem, PremiumDestination, PremiumMatch, PremiumPitch, PremiumSection } from "@/components/fc/premium-ui";

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from "@/lib/auth-client";

interface CareerData {
  profile: {
    playerCode: string | null;
    profileImageUrl: string | null;

    identity: {
      inGameName: string;
      isVerified: boolean;
    } | null;

    primaryLeague: {
      league: {
        id: string;
        name: string;
        code: string;
        logoUrl: string | null;
        region: string | null;
      };
    } | null;

    secondaryLeague: {
      league: {
        id: string;
        name: string;
        code: string;
        logoUrl: string | null;
        region: string | null;
      };
    } | null;
  };

  lifetimeStatistics: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    winRate: number;
  };

  tournamentHistory: Array<{
    tournament: {
      id: string;
    };

    registration: {
      id: string;
      entryName: string | null;
    };
  }>;

  matchHistory: Array<{
    id: string;
    outcome: "W" | "D" | "L";
    confirmedAt: string;

    tournament: {
      name: string;

      league: {
        name: string;
      };
    };

    home: {
      name: string;
      score: number;
    };

    away: {
      name: string;
      score: number;
    };
  }>;
}

interface Membership {
  membershipType: "PRIMARY" | "SECONDARY";

  adminRole: "OWNER" | "ADMIN" | null;

  league: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
    region: string | null;
    members: number;
    maxMembers: number;
  };
}

interface Tournament {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  status: string;
  format: string;
  competitionFormat?: string;
  approvedEntries: number;
  maxEntries: number;
  startAt: string | null;
}

interface FixtureEntry {
  id: string;
  entryName: string | null;

  members: Array<{
    id: string;
    fullName: string;
    inGameName: string | null;
  }>;
}

interface Fixture {
  id: string;
  sequence: number;
  matchday: number | null;
  roundName: string;
  status: string;
  scheduledAt: string | null;
  home: FixtureEntry | null;
  away: FixtureEntry | null;

  match: {
    id: string;
    status: string;
  } | null;
}

interface DashboardTournament extends Tournament {
  leagueId: string;
  leagueName: string;
}

interface DashboardFixture extends Fixture {
  tournamentId: string;
  tournamentName: string;
  leagueName: string;
}

function entryName(entry: FixtureEntry | null) {
  if (!entry) {
    return "TBD";
  }

  return (
    entry.entryName ||
    entry.members[0]?.inGameName ||
    entry.members[0]?.fullName ||
    "Entry"
  );
}

function fixtureIsOpen(fixture: DashboardFixture) {
  return (
    !["COMPLETED", "CANCELLED"].includes(fixture.status) &&
    !["COMPLETED", "CANCELLED"].includes(fixture.match?.status ?? "")
  );
}

function sortUpcoming(first: DashboardFixture, second: DashboardFixture) {
  const now = Date.now();

  const firstTime = first.scheduledAt
    ? new Date(first.scheduledAt).getTime()
    : null;

  const secondTime = second.scheduledAt
    ? new Date(second.scheduledAt).getTime()
    : null;

  const firstFuture = firstTime !== null && firstTime >= now;

  const secondFuture = secondTime !== null && secondTime >= now;

  if (firstFuture && secondFuture) {
    return firstTime! - secondTime!;
  }

  if (firstFuture) {
    return -1;
  }

  if (secondFuture) {
    return 1;
  }

  if (firstTime === null && secondTime === null) {
    return first.sequence - second.sequence;
  }

  if (firstTime === null) {
    return -1;
  }

  if (secondTime === null) {
    return 1;
  }

  return first.sequence - second.sequence;
}

function fixtureBelongsToUser(
  fixture: DashboardFixture,
  userId: string,
  registrationId: string | null,
) {
  if (
    registrationId &&
    (fixture.home?.id === registrationId || fixture.away?.id === registrationId)
  ) {
    return true;
  }

  return [
    ...(fixture.home?.members ?? []),

    ...(fixture.away?.members ?? []),
  ].some((member) => member.id === userId);
}

function SectionTitle({
  icon,
  title,
  href,
  linkLabel = "View All →",
}: {
  icon: FcIconName;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className="theme-soft-accent grid h-10 w-10 place-items-center rounded-xl border"
          aria-hidden="true"
        >
          <FcIcon name={icon} size={19} />
        </span>

        <h2 className="theme-text fc-display text-[19px] font-semibold">
          {title}
        </h2>
      </div>

      {href ? (
        <Link
          href={href}
          className="theme-text-link inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-xs font-medium transition"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [career, setCareer] = useState<CareerData | null>(null);

  const [memberships, setMemberships] = useState<Membership[]>([]);

  const [tournaments, setTournaments] = useState<DashboardTournament[]>([]);

  const [fixtures, setFixtures] = useState<DashboardFixture[]>([]);

  const [error, setError] = useState("");

  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [currentUser, summary] = await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{ data: {
            career: CareerData;
            memberships: Membership[];
            tournaments: DashboardTournament[];
            fixtures: DashboardFixture[];
          } }>("/players/me/dashboard"),
        ]);
        if (cancelled) return;
        setUser(currentUser);
        setCareer(summary.data.career);
        setMemberships(summary.data.memberships);
        setTournaments(summary.data.tournaments);
        setFixtures(summary.data.fixtures);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError("Unable to load your dashboard. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [router, retryCount]);

  const primaryMembership = useMemo(
    () =>
      memberships.find(
        (membership) => membership.membershipType === "PRIMARY",
      ) ??
      memberships[0] ??
      null,
    [memberships],
  );

  const activeTournament = useMemo(
    () =>
      tournaments.find(
        (tournament) => !["COMPLETED", "CANCELLED"].includes(tournament.status),
      ) ?? null,
    [tournaments],
  );

  const registrationIdsByTournament = useMemo(
    () =>
      new Map(
        (career?.tournamentHistory ?? []).map((entry) => [
          entry.tournament.id,

          entry.registration.id,
        ]),
      ),
    [career],
  );

  const personalOpenFixtures = useMemo(() => {
    if (!user) {
      return [];
    }

    return fixtures
      .filter(
        (fixture) =>
          fixtureIsOpen(fixture) &&
          fixtureBelongsToUser(
            fixture,
            user.id,
            registrationIdsByTournament.get(fixture.tournamentId) ?? null,
          ),
      )
      .sort(sortUpcoming);
  }, [fixtures, registrationIdsByTournament, user]);

  const nextFixture = personalOpenFixtures[0] ?? null;

  const activeTournamentNextFixture = useMemo(() => {
    if (!activeTournament) {
      return null;
    }

    return (
      personalOpenFixtures.find(
        (fixture) => fixture.tournamentId === activeTournament.id,
      ) ?? null
    );
  }, [activeTournament, personalOpenFixtures]);

  if (error) return (
    <AppShell><FcPanel className="p-6">
      <h1 className="theme-text text-lg font-semibold">Dashboard unavailable</h1>
      <p role="alert" className="theme-muted mt-2">{error}</p>
      <button disabled={loading} className="theme-primary-button mt-4 min-h-11 rounded-lg px-5" onClick={() => setRetryCount(count => count + 1)}>Retry</button>
    </FcPanel></AppShell>
  );

  if (loading || !user || !career) {
    return <FcLoadingScreen label="Loading Home..." />;
  }

  const inGameName =
    career.profile.identity?.inGameName ||
    user.player?.identity?.inGameName ||
    user.fullName;

  const playerCode =
    career.profile.playerCode || user.player?.playerCode || "Pending";

  const stats = career.lifetimeStatistics;

  const isLeagueAdmin = Boolean(primaryMembership?.adminRole);

  const leagueLogo =
    primaryMembership?.league.logoUrl ||
    career.profile.primaryLeague?.league.logoUrl ||
    null;

  const createTournamentHref = primaryMembership
    ? `/leagues/${primaryMembership.league.id}/tournaments`
    : "/leagues";

  const progress =
    activeTournament && activeTournament.maxEntries > 0
      ? Math.min(
          100,
          (activeTournament.approvedEntries / activeTournament.maxEntries) *
            100,
        )
      : 0;

  const recentActivity = career.matchHistory.slice(0, 3);

  return (
    <AppShell
      playerName={inGameName}
      playerRole={primaryMembership?.adminRole || "Player"}
    >
      <div className="premium-page premium-dashboard fc-dashboard-page">
        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <section className="premium-hero premium-home-hero">
          <PremiumPitch />
          <div className="premium-hero-copy">
            <p className="premium-eyebrow">FC ARENA · Your competition home</p>
            <h1>More than<br />a game.</h1>
            <p className="premium-hero-description">Welcome back, {inGameName}. Your next match is where the story continues.</p>
            <div className="premium-home-context">
              <FcCrest name={primaryMembership?.league.name || inGameName} imageUrl={leagueLogo || career.profile.profileImageUrl} size="md" />
              <div><strong>{primaryMembership?.league.name || "Build your competition legacy"}</strong><p>{activeTournament?.name || "Choose a league. Enter a tournament. Make your mark."}</p></div>
            </div>
            <div className="premium-hero-tags"><span>{playerCode}</span><span>{primaryMembership?.adminRole || "Player"}</span><span>{user.status}</span>{career.profile.identity?.isVerified ? <span>Verified identity</span> : null}</div>
          </div>
          <div className="premium-home-next">
            {nextFixture ? <PremiumMatch home={entryName(nextFixture.home)} away={entryName(nextFixture.away)} label={`Next Match · ${nextFixture.tournamentName} · ${nextFixture.roundName}`} status={<FcStatusBadge label={nextFixture.match?.status || nextFixture.status} />} href={nextFixture.match?.id ? `/matches/${nextFixture.match.id}` : `/tournaments/${nextFixture.tournamentId}/fixtures`} action="View Match">
              <span>{nextFixture.scheduledAt ? new Date(nextFixture.scheduledAt).toLocaleString() : "Schedule pending"}</span>
            </PremiumMatch> : <div className="premium-home-empty"><FcIcon name="fixtures" size={36} /><h2>Your next chapter</h2><p>Your next scheduled fixture will appear here when a competition schedule is ready.</p><Link className="theme-primary-button premium-button" href="/fixtures">View Fixtures <FcIcon name="chevronRight" size={16} /></Link></div>}
          </div>
        </section>

        <PlayerOnboarding userId={user.id} profile={!!career.profile.identity} league={!!primaryMembership} registered={career.tournamentHistory.length > 0} />
        <PremiumDestination href="/notifications" icon="bell" title="Your action inbox" detail="Reminders, approvals and competition updates" />

        <section className="fc-dashboard-section grid gap-[18px] xl:grid-cols-[1.75fr_0.95fr]">
          <PremiumSection label="Your matchday" title="Upcoming matches" href="/fixtures">
            <div className="premium-ledger">
              {personalOpenFixtures.slice(0, 3).map(fixture => <Link key={fixture.id} className="premium-ledger-row" href={fixture.match?.id ? `/matches/${fixture.match.id}` : `/tournaments/${fixture.tournamentId}/fixtures`}><div><p>{entryName(fixture.home)} <span className="theme-muted">vs</span> {entryName(fixture.away)}</p><small>{fixture.tournamentName} · {fixture.roundName}</small></div><FcIcon name="chevronRight" size={18} /></Link>)}
              {personalOpenFixtures.length === 0 ? <div><p className="font-semibold">No upcoming match</p><p className="theme-secondary-text mt-2 text-sm">Your schedule will appear when fixtures are ready.</p><Link className="premium-quiet" href="/fixtures">View Fixtures →</Link></div> : null}
            </div>
          </PremiumSection>

          <FcPanel className="fc-league-panel p-5 sm:p-6">
            <SectionTitle
              icon="league"
              title="My League"
              href="/leagues"
              linkLabel="All Leagues →"
            />

            {primaryMembership ? (
              <>
                <div className="mt-6 flex items-center gap-4">
                  <FcCrest
                    name={primaryMembership.league.name}
                    imageUrl={leagueLogo}
                    size="lg"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-[#0B2545]">
                      {primaryMembership.league.name}
                    </h3>

                    <p className="mt-1 font-mono text-xs font-semibold text-[#A06B13]">
                      {primaryMembership.league.code}
                    </p>

                    <div className="mt-2">
                      <FcStatusBadge
                        label={primaryMembership.membershipType}
                        tone="cyan"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="fc-luxury-info rounded-xl p-3">
                    <p className="text-xs text-[#8792A1]">Region</p>

                    <p className="mt-1 truncate text-sm font-medium text-[#0B2545]">
                      {primaryMembership.league.region || "Global"}
                    </p>
                  </div>

                  <div className="fc-luxury-info rounded-xl p-3">
                    <p className="text-xs text-[#8792A1]">Members</p>

                    <p className="mt-1 text-sm font-medium text-[#0B2545]">
                      {primaryMembership.league.members}
                    </p>
                  </div>

                  <div className="fc-luxury-info rounded-xl p-3">
                    <p className="text-xs text-[#8792A1]">Role</p>

                    <p className="mt-1 truncate text-sm font-medium text-[#0B2545]">
                      {primaryMembership.adminRole || "Player"}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/leagues/${primaryMembership.league.id}`}
                  className="theme-secondary-button mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border px-5 text-sm font-semibold transition"
                >
                  Open League →
                </Link>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#DED8CD] bg-[#FBF8F2] p-6 text-center">
                <p className="text-base font-semibold text-[#0B2545]">
                  No active League
                </p>

                <p className="mt-2 text-sm leading-6 text-[#8792A1]">
                  Join with an invite code or create your own FC ARENA League.
                </p>

                <Link
                  href="/leagues"
                  className="theme-primary-button mt-5 inline-flex min-h-12 items-center justify-center rounded-[10px] px-5 text-sm font-semibold"
                >
                  Join or Create League →
                </Link>
              </div>
            )}
          </FcPanel>
        </section>

        <section className="fc-dashboard-section grid gap-5">
          <FcPanel className="fc-tournament-panel p-5 sm:p-6">
            <SectionTitle
              icon="tournament"
              title="Active Tournament"
              href="/tournaments"
            />

            {activeTournament ? (
              <>
                <div className="mt-6 flex items-center gap-4">
                  <FcCrest
                    name={activeTournament.name}
                    imageUrl={activeTournament.logoUrl}
                    size="lg"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-[#0B2545]">
                      {activeTournament.name}
                    </h3>

                    <p className="mt-1 text-xs text-[#8792A1]">
                      {(
                        activeTournament.competitionFormat ||
                        activeTournament.format
                      ).replaceAll("_", " ")}
                    </p>

                    <div className="mt-2">
                      <FcStatusBadge
                        label={activeTournament.status}
                        tone="emerald"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#8792A1]">Competition progress</span>

                    <span className="font-medium text-[#54657A]">
                      {activeTournament.approvedEntries}/
                      {activeTournament.maxEntries} entries
                    </span>
                  </div>

                  <div className="theme-progress-track mt-2 h-2 overflow-hidden rounded-full">
                    <div
                      className="theme-progress-bar h-full rounded-full"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                </div>

                {activeTournamentNextFixture ? (
                  <div className="mt-5 rounded-xl border border-[#E3DCCF] bg-[#FAF7F0] p-4">
                    <p className="text-xs text-[#8792A1]">Next fixture</p>

                    <p className="mt-1 truncate text-sm font-medium text-[#0B2545]">
                      {entryName(activeTournamentNextFixture.home)}
                      {"  vs  "}
                      {entryName(activeTournamentNextFixture.away)}
                    </p>
                  </div>
                ) : null}

                <Link
                  href={`/tournaments/${activeTournament.id}`}
                  className="theme-secondary-button mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border px-5 text-sm font-semibold transition"
                >
                  View Tournament →
                </Link>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#DED8CD] bg-[#FBF8F2] p-6 text-center sm:p-8">
                <div className="theme-soft-accent mx-auto grid h-12 w-12 place-items-center rounded-xl border text-lg">
                  <FcIcon name="trophy" size={22} />
                </div>

                <h3 className="mt-4 text-base font-semibold text-[#0B2545]">
                  No Active Tournament
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8792A1]">
                  Browse your League competitions or start a new Tournament when
                  you have admin access.
                </p>

                <Link
                  href="/tournaments"
                  className="theme-primary-button mt-5 inline-flex min-h-12 items-center justify-center rounded-[10px] px-5 text-sm font-semibold"
                >
                  Browse Tournaments →
                </Link>
              </div>
            )}
          </FcPanel>
        </section>

        <section className="premium-metrics fc-dashboard-stats" aria-label="Career at a glance">
          <Link href="/career">
            <FcStatCard
              label="Matches"
              value={stats.matches}
              detail="View career stats"
              icon="▤"
            />
          </Link>

          <Link href="/career">
            <FcStatCard
              label="Wins"
              value={stats.wins}
              detail={`${stats.draws} draws • ${stats.losses} losses`}
              tone="emerald"
              icon="✓"
            />
          </Link>

          <Link href="/career">
            <FcStatCard
              label="Goals"
              value={stats.goalsFor}
              detail={`Goal difference: ${stats.goalDifference > 0 ? "+" : ""}${stats.goalDifference}`}
              tone="amber"
              icon="fixtures"
            />
          </Link>

          <Link href="/career">
            <FcStatCard
              label="Win Rate"
              value={`${stats.winRate}%`}
              detail="View detailed stats"
              icon="↗"
            />
          </Link>
        </section>

        <div className="premium-feature-pair">
          <Link href="/awards" className="premium-prestige-gateway"><AwardEmblem /><div><p className="premium-eyebrow">Hall of honours</p><h2>Greatness gets recognised.</h2><p>Follow the Ballon, Golden Boot and Golden Glove races.</p><span className="premium-quiet">Explore Awards →</span></div></Link>
          <Link href="/league-war" className="premium-rivalry-gateway"><FcIcon name="war" size={42} /><div><p className="premium-eyebrow">League against league</p><h2>A rivalry worth playing.</h2><p>Locked rosters. Verified results. One winning league.</p><span className="premium-quiet">Enter League War →</span></div></Link>
        </div>
        <FcPanel className="fc-activity-panel p-5 sm:p-6">
          <SectionTitle
            icon="history"
            title="Latest Activity"
            href="/career/matches"
            linkLabel="View all →"
          />

          {recentActivity.length > 0 ? (
            <div className="mt-5 divide-y divide-[#203141]">
              {recentActivity.map((activity) => (
                <Link
                  key={activity.id}
                  href={`/matches/${activity.id}`}
                  className="flex flex-col gap-3 py-4 transition first:pt-0 last:pb-0 hover:bg-white/[0.012] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-xs font-semibold ${
                        activity.outcome === "W"
                          ? "border-[#1FD18A]/20 bg-[#1FD18A]/[0.07] text-[#1FD18A]"
                          : activity.outcome === "D"
                            ? "border-[#F3B326]/20 bg-[#F3B326]/[0.07] text-[#F3B326]"
                            : "border-[#EF5350]/20 bg-[#EF5350]/[0.07] text-[#EF5350]"
                      }`}
                    >
                      {activity.outcome}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0B2545]">
                        {activity.tournament.name}
                      </p>

                      <p className="mt-1 truncate text-xs text-[#8792A1]">
                        {activity.tournament.league.name}
                      </p>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-sm font-semibold text-[#54657A]">
                      {activity.home.name}{" "}
                      <span className="text-[#0B2545]">
                        {activity.home.score}-{activity.away.score}
                      </span>{" "}
                      {activity.away.name}
                    </p>

                    <p className="mt-1 text-xs text-[#536273]">
                      {new Date(activity.confirmedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-dashed border-[#DED8CD] bg-[#FBF8F2] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0B2545]">
                  No recent activity
                </p>

                <p className="mt-1 text-sm text-[#8792A1]">
                  Verified match results will appear here.
                </p>
              </div>

              <Link
                href="/fixtures"
                className="theme-secondary-button inline-flex min-h-11 items-center justify-center rounded-[10px] border px-4 text-sm font-medium"
              >
                View Fixtures →
              </Link>
            </div>
          )}
        </FcPanel>
        <PremiumSection label="Make your next move" title="Quick Actions">
          <div className="premium-quick-actions">
            <PremiumDestination href="/leagues" icon="join" title="Join League" detail="Use an invite code" />
            <PremiumDestination href={createTournamentHref} icon="tournament" title={isLeagueAdmin ? "Create Tournament" : "Tournaments"} detail={isLeagueAdmin ? "Start a new competition" : "Browse competitions"} />
            <PremiumDestination href="/fixtures" icon="fixtures" title="View Fixtures" detail="Check upcoming matches" />
            <PremiumDestination href={primaryMembership ? `/leaderboards?league=${primaryMembership.league.id}` : "/leaderboards"} icon="leaderboard" title="Leaderboard" detail="League performance rankings" />
            <PremiumDestination href="/profile" icon="profile" title="Update Profile" detail="Edit your information" />
          </div>
        </PremiumSection>
      </div>
    </AppShell>
  );
}
