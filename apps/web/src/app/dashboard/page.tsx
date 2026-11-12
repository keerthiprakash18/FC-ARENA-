"use client";
import { TournamentRegistrationSummary } from '@/components/tournaments/registration-summary';

import { PlayerOnboarding } from "@/components/fc/player-onboarding";
import Link from "next/link";
import { useActiveLeague } from '@/lib/active-league';
import { useRecoverableLoad } from '@/lib/use-recoverable-load';
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app/app-shell";
import { FixtureTeamButton } from '@/components/tournaments/fixture-team-button';

import type { FcIconName } from "@/components/fc/fc-icons";

import { FcIcon } from "@/components/fc/fc-icons";

import {
  FcCrest,
  FcLoadingScreen,
  FcPanel,
  FcQuickActionTile,
  FcStatCard,
  FcStatusBadge,
} from "@/components/fc/fc-ui";

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
  pendingEntries?: number;
  registeredEntries?: number;
  maxEntries: number;
  startAt: string | null;
}

interface FixtureEntry {
  id: string;
  entryName: string | null;
  entryLogoUrl?: string | null;

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
  leagueId: string;
  tournamentName: string;
  leagueName: string;
}

type DashboardSection = "nextMatch" | "league" | "activeTournament" | "stats" | "quickActions" | "activity";

type NextFixtureKind = "LIVE" | "TODAY" | "UPCOMING" | "POSTPONED" | "UNSCHEDULED" | "PENDING";

const TERMINAL_FIXTURE_STATUSES = new Set(["COMPLETED", "CANCELLED"]);
const LIVE_FIXTURE_STATUSES = new Set(["LIVE", "IN_PROGRESS"]);

function fixtureStatus(fixture: DashboardFixture) {
  const matchStatus = fixture.match?.status?.toUpperCase();
  const fixtureStatusValue = fixture.status.toUpperCase();

  if (TERMINAL_FIXTURE_STATUSES.has(fixtureStatusValue)) return fixtureStatusValue;
  if (matchStatus && TERMINAL_FIXTURE_STATUSES.has(matchStatus)) return matchStatus;

  if (matchStatus && LIVE_FIXTURE_STATUSES.has(matchStatus)) {
    return matchStatus;
  }

  if (LIVE_FIXTURE_STATUSES.has(fixtureStatusValue)) {
    return fixtureStatusValue;
  }

  if (fixtureStatusValue === "POSTPONED") return fixtureStatusValue;

  if (matchStatus && matchStatus !== "UNSCHEDULED") {
    return matchStatus;
  }

  return fixtureStatusValue;
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

function fixtureIsRelevant(fixture: DashboardFixture) {
  return !TERMINAL_FIXTURE_STATUSES.has(fixtureStatus(fixture));
}

function fixtureTime(fixture: DashboardFixture) {
  if (!fixture.scheduledAt) {
    return null;
  }

  const timestamp = new Date(fixture.scheduledAt).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function sortByFixtureTime(first: DashboardFixture, second: DashboardFixture) {
  const firstTime = fixtureTime(first);
  const secondTime = fixtureTime(second);

  if (firstTime === null && secondTime === null) {
    return first.sequence - second.sequence;
  }

  if (firstTime === null) {
    return 1;
  }

  if (secondTime === null) {
    return -1;
  }

  return firstTime! - secondTime! || first.sequence - second.sequence;
}

function isLiveFixture(fixture: DashboardFixture) {
  return LIVE_FIXTURE_STATUSES.has(fixtureStatus(fixture));
}

function isPostponedFixture(fixture: DashboardFixture) {
  return fixtureStatus(fixture) === "POSTPONED";
}

function isUnscheduledFixture(fixture: DashboardFixture) {
  return fixtureTime(fixture) === null && !isLiveFixture(fixture) && !isPostponedFixture(fixture);
}

function isFutureScheduledFixture(fixture: DashboardFixture, nowMs: number) {
  const scheduledAt = fixtureTime(fixture);

  return (
    scheduledAt !== null &&
    scheduledAt >= nowMs &&
    !isPostponedFixture(fixture) && fixtureIsRelevant(fixture)
  );
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function isToday(value: string | null, nowMs: number) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return localDateKey(date) === localDateKey(new Date(nowMs));
}

function fixtureKind(fixture: DashboardFixture, nowMs: number): NextFixtureKind {
  if (isLiveFixture(fixture)) {
    return "LIVE";
  }

  if (isPostponedFixture(fixture)) {
    return "POSTPONED";
  }

  if (isUnscheduledFixture(fixture)) {
    return "UNSCHEDULED";
  }

  if ((fixtureTime(fixture) ?? nowMs) < nowMs && !isToday(fixture.scheduledAt, nowMs)) return "PENDING";

  return isToday(fixture.scheduledAt, nowMs) ? "TODAY" : "UPCOMING";
}

function formatFixtureDateTime(value: string | null) {
  if (!value) {
    return "Schedule pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Schedule pending";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCountdown(value: string | null, nowMs: number) {
  const scheduledAt = value ? new Date(value).getTime() : Number.NaN;
  const remainingMs = scheduledAt - nowMs;

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "Starting now";
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `Starts in ${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `Starts in ${hours}h ${minutes}m`;
  }

  return `Starts in ${Math.max(1, minutes)}m`;
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

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [career, setCareer] = useState<CareerData | null>(null);

  const [memberships, setMemberships] = useState<Membership[]>([]);

  const [selectedLeagueId, setSelectedLeagueId] = useActiveLeague(user?.id, memberships);

  const [tournaments, setTournaments] = useState<DashboardTournament[]>([]);

  const [fixtures, setFixtures] = useState<DashboardFixture[]>([]);

  const [hiddenSections, setHiddenSections] = useState<DashboardSection[]>([]);


  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const initialLoad = useRecoverableLoad(async signal => {
    if (!career) setLoading(true);
    try {
      const [currentUser, summary] = await Promise.all([
        getCurrentUser({ signal }),
        authenticatedRequest<{ data: { career: CareerData; memberships: Membership[];
          tournaments: DashboardTournament[]; fixtures: DashboardFixture[] } }>("/players/me/dashboard", { signal }),
      ]);
      if (signal.aborted) return;
      setUser(currentUser); setCareer(summary.data.career); setMemberships(summary.data.memberships);
      setTournaments(summary.data.tournaments); setFixtures(summary.data.fixtures); setNowMs(Date.now());
    } finally { if (!signal.aborted) setLoading(false); }
  }, String(retryCount));
  const error = initialLoad.error;
  const reloadDashboard = initialLoad.reload;

  // Personal display preferences must not hold up the player's fixture data.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const controller = new AbortController();
    void authenticatedRequest<{ data: { preferences: { hiddenSections: DashboardSection[] } } }>(
      "/auth/preferences/dashboard", { signal: controller.signal },
    ).then(result => {
      if (!cancelled) setHiddenSections(result.data.preferences.hiddenSections ?? []);
    }).catch(() => {});
    return () => { cancelled = true; controller.abort(); };
  }, [user?.id, retryCount]);

  // Revalidate the mounted dashboard without hiding loaded cards or resetting filters.
  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => { if (navigator.onLine !== false && document.visibilityState !== 'hidden') void reloadDashboard(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [user?.id, reloadDashboard]);

  const primaryMembership = useMemo(
    () =>
      memberships.find(
        (membership) => membership.membershipType === "PRIMARY",
      ) ??
      memberships[0] ??
      null,
    [memberships],
  );

  const selectedMembership = useMemo(
    () =>
      memberships.find(
        (membership) => membership.league.id === selectedLeagueId,
      ) ?? primaryMembership,
    [memberships, primaryMembership, selectedLeagueId],
  );

  const scopedTournaments = useMemo(
    () =>
      selectedMembership
        ? tournaments.filter(
            (tournament) => tournament.leagueId === selectedMembership.league.id,
          )
        : tournaments,
    [selectedMembership, tournaments],
  );

  const scopedTournamentIds = useMemo(
    () => new Set([
      ...scopedTournaments.map((tournament) => tournament.id),
      ...fixtures.filter(fixture => fixture.leagueId === selectedMembership?.league.id).map(fixture => fixture.tournamentId),
    ]),
    [scopedTournaments, fixtures, selectedMembership],
  );

  const activeTournament = useMemo(
    () =>
      scopedTournaments.find(tournament => fixtures.some(fixture => fixture.tournamentId === tournament.id)) ??
      scopedTournaments.find(tournament => career?.tournamentHistory.some(entry => entry.tournament.id === tournament.id)) ??
      scopedTournaments.find(
        (tournament) => !["COMPLETED", "CANCELLED"].includes(tournament.status),
      ) ?? null,
    [scopedTournaments, fixtures, career],
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

  const personalRelevantFixtures = useMemo(() => {
    if (!user) {
      return [];
    }

    const scopedFixtures = fixtures.filter((fixture) => scopedTournamentIds.has(fixture.tournamentId));

    return scopedFixtures
      .filter(
        (fixture) =>
          fixtureIsRelevant(fixture) &&
          fixtureBelongsToUser(
            fixture,
            user.id,
            registrationIdsByTournament.get(fixture.tournamentId) ?? null,
          ),
      )
      .sort(sortByFixtureTime);
  }, [fixtures, registrationIdsByTournament, scopedTournamentIds, user]);

  const liveFixture = personalRelevantFixtures.find(isLiveFixture) ?? null;

  const scheduledFixture =
    personalRelevantFixtures.find((fixture) =>
      isFutureScheduledFixture(fixture, nowMs),
    ) ?? null;

  const postponedFixture =
    personalRelevantFixtures.find(isPostponedFixture) ?? null;

  const unscheduledFixture =
    personalRelevantFixtures.find(isUnscheduledFixture) ?? null;

  const pendingFixture = personalRelevantFixtures.find(fixture =>
    !isPostponedFixture(fixture) && fixtureTime(fixture) !== null && fixtureTime(fixture)! < nowMs,
  ) ?? null;

  const nextFixture = liveFixture ?? scheduledFixture ?? pendingFixture ?? postponedFixture ?? unscheduledFixture;
  const nextFixtureKind = nextFixture
    ? fixtureKind(nextFixture, nowMs)
    : null;

  const activeTournamentNextFixture = useMemo(() => {
    if (!activeTournament) {
      return null;
    }

    return (
      personalRelevantFixtures.find(
          (fixture) =>
            fixture.tournamentId === activeTournament.id &&
            fixtureIsRelevant(fixture),
      ) ?? null
    );
  }, [activeTournament, personalRelevantFixtures]);

  if (error) return (
    <AppShell><FcPanel className="p-6">
      <h1 className="theme-text text-lg font-semibold">Dashboard unavailable</h1>
      <p role="alert" className="theme-muted mt-2">{error}</p>
      <button disabled={loading} className="theme-primary-button mt-4 min-h-11 rounded-lg px-5" onClick={() => setRetryCount(count => count + 1)}>Retry</button>
    </FcPanel></AppShell>
  );

  if (loading || !user || !career) {
    return <AppShell currentUser={user ?? undefined}><FcLoadingScreen label="Loading Home..." embedded /></AppShell>;
  }

  const inGameName =
    career.profile.identity?.inGameName ||
    user.player?.identity?.inGameName ||
    user.fullName;

  const playerCode =
    career.profile.playerCode || user.player?.playerCode || "Pending";

  const stats = career.lifetimeStatistics;

  const isLeagueAdmin = Boolean(selectedMembership?.adminRole);

  const leagueLogo =
    selectedMembership?.league.logoUrl ??
    (selectedMembership &&
    career.profile.primaryLeague?.league.id === selectedMembership.league.id
      ? career.profile.primaryLeague.league.logoUrl
      : selectedMembership &&
          career.profile.secondaryLeague?.league.id === selectedMembership.league.id
        ? career.profile.secondaryLeague.league.logoUrl
        : null);

  const createTournamentHref = selectedMembership
    ? `/leagues/${selectedMembership.league.id}/tournaments`
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
  const isVisible = (section: DashboardSection) => !hiddenSections.includes(section);
  const showNextMatch = isVisible("nextMatch") && Boolean(nextFixture);
  const showLeague = isVisible("league") && Boolean(selectedMembership);
  const hasProfile = Boolean(career.profile.identity || user.player?.identity);
  const heroAction = nextFixture
    ? showNextMatch
      ? { href: "#dashboard-next-match", label: "See next match ↓", jump: true }
      : { href: nextFixture.match?.id ? `/matches/${nextFixture.match.id}` : `/tournaments/${nextFixture.tournamentId}/fixtures`, label: "Open Match Centre →", jump: false }
    : !hasProfile
      ? { href: "/profile", label: "Complete Profile →", jump: false }
      : !selectedMembership
        ? { href: "/leagues", label: "Join a League →", jump: false }
        : { href: activeTournament ? "/fixtures" : "/tournaments", label: activeTournament ? "View Fixtures →" : "Browse Tournaments →", jump: false };
  const nextActions = [
    ...(!hasProfile ? [{
      id: 'profile',
      label: 'Complete player profile',
      description: 'Finish your player identity before joining competitions.',
      href: '/profile',
    }] : []),
    ...(!selectedMembership ? [{
      id: 'join',
      label: 'Join a league',
      description: 'Find or join a league to see fixtures and rankings.',
      href: '/leagues',
    }] : []),
    ...(nextFixture ? [{
      id: 'match',
      label: nextFixtureKind === 'LIVE' ? 'Open live match' : nextFixtureKind === 'PENDING' ? 'Check pending fixture' : 'See your next fixture',
      description: `${nextFixture.tournamentName} · ${nextFixture.roundName}`,
      href: nextFixture.match?.id
        ? `/matches/${nextFixture.match.id}`
        : `/tournaments/${nextFixture.tournamentId}/fixtures`,
    }] : []),
    ...(isLeagueAdmin && activeTournament && (activeTournament.pendingEntries ?? 0) > 0 ? [{
      id: 'approvals',
      label: 'Review tournament entries',
      description: `${activeTournament.pendingEntries} registration(s) awaiting review.`,
      href: `/tournaments/${activeTournament.id}/teams`,
    }] : []),
  ].slice(0, 3);

  const emptyUpdates = [
    ...(isVisible("league") && !selectedMembership ? [{ key: "league", icon: "league" as FcIconName, title: "My League", description: "No active League", href: "/leagues", action: "Find a league" }] : []),
    ...(isVisible("activeTournament") && !activeTournament ? [{ key: "tournament", icon: "tournament" as FcIconName, title: "Active Tournament", description: "No active tournament", href: "/tournaments", action: "Browse cups" }] : []),
    ...(isVisible("nextMatch") && !nextFixture ? [{ key: "fixture", icon: "fixtures" as FcIconName, title: "Next Match", description: "No upcoming matches scheduled", href: "/fixtures", action: "Fixtures" }] : []),
  ];

  return (
    <AppShell
      currentUser={user}
      playerName={inGameName}
      playerRole={selectedMembership?.adminRole || "Player"}
    >
      <div className="fc-dashboard-page premium-dashboard fc-dashboard-classic relative grid gap-4 sm:gap-6">
        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <section className="fc-dashboard-hero fc-stadium-surface relative min-h-[220px] overflow-hidden rounded-2xl border premium-home-hero">
          <div className="fc-hero-right hidden lg:block" />

          <div className="home-hero-layout relative z-10 grid min-h-[220px] gap-6 px-6 py-6 sm:px-7 lg:grid-cols-[auto_minmax(0,1fr)_300px] sm:py-6 lg:items-center lg:px-8">
            <div className="home-hero-avatar">
              <div className="theme-hero-avatar-ring grid h-[68px] w-[68px] place-items-center rounded-full border-[3px] sm:h-[82px] sm:w-[82px] lg:h-[86px] lg:w-[86px]">
                <FcCrest
                  name={inGameName}
                  imageUrl={career.profile.profileImageUrl}
                  size="lg"
                />
              </div>
            </div>

            <div className="home-hero-copy min-w-0 lg:pr-5">
              <p className="theme-hero-kicker fc-dashboard-kicker text-[12px] font-bold tracking-[0.16em]">
                <span className="fc-dashboard-live-dot" aria-hidden="true" />
                FC ARENA MATCHDAY
              </p>

              <h1 className="theme-text mt-2 break-words text-[30px] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[42px] lg:text-[48px]">
                <span className="home-welcome">Welcome back, </span><span className="home-player-name">{inGameName}</span>
              </h1>

              <p className="home-hero-description theme-secondary-text mt-3 max-w-2xl text-[14px] leading-6">
                {nextFixture ? "Your next fixture is ready. Get match ready." : selectedMembership ? "Your league, fixtures and season at a glance." : "Join your first league and get match ready."}
              </p>

              <div className="home-hero-tags mt-4 flex flex-wrap items-center gap-2">
                <span className="theme-soft-accent rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold">
                  {playerCode}
                </span>

                <FcStatusBadge label={user.status} tone="emerald" />

                {career.profile.identity?.isVerified ? (
                  <FcStatusBadge label="Verified" tone="amber" />
                ) : null}

                <Link
                  href={heroAction.href}
                  className={`${heroAction.jump ? "home-hero-jump" : "theme-primary-button"} home-hero-action inline-flex min-h-11 items-center justify-center rounded-[10px] px-4 text-xs font-semibold`}
                >
                  {heroAction.label}
                </Link>
              </div>
            </div>

            <div className="theme-hero-side-copy relative hidden h-full min-h-[168px] lg:block">
              <div className="absolute right-2 top-2 text-right">
                <p className="theme-hero-slogan rotate-[-5deg] text-[21px] font-semibold italic leading-[0.95] tracking-[-0.025em]">
                  More Than
                  <br />A Game
                </p>
              </div>

              <div className="absolute bottom-1 right-2 text-right">
                <p className="theme-hero-side-label text-[10px] font-semibold tracking-[0.18em]">
                  PLAY
                  <br />
                  COMPETE
                  <br />
                  BELONG
                </p>

                <p className="theme-hero-side-code mt-3 font-mono text-[10px] tracking-[0.08em]">
                  {playerCode}
                </p>
              </div>
            </div>
          </div>
        </section>

        {nextActions.length > 0 ? (
          <section aria-labelledby="dashboard-actions-title" className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="dashboard-actions-title" className="theme-text text-base font-bold">Your next steps</h2>
              <span className="theme-secondary-text text-xs">Based on your current league and fixtures</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {nextActions.map((action) => (
                <Link key={action.id} href={action.href} className="theme-secondary-button flex min-h-11 flex-col justify-center rounded-xl border border-[var(--theme-border)] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2">
                  <span className="theme-text text-sm font-semibold">{action.label} <span aria-hidden="true">→</span></span>
                  <span className="theme-secondary-text mt-1 text-xs leading-5">{action.description}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {showNextMatch || showLeague ? (
        <section id="dashboard-next-match" tabIndex={-1} aria-label="Match and league overview" className={`fc-dashboard-section grid items-start gap-4 sm:gap-6 ${showNextMatch && showLeague ? "xl:grid-cols-[minmax(0,1.75fr)_minmax(0,0.95fr)]" : ""}`}>
          {showNextMatch ? <FcPanel className="fc-next-match-panel premium-home-next relative overflow-hidden p-5 sm:p-6">
            <div className="theme-match-art pointer-events-none absolute inset-x-0 bottom-0 h-[72%]" />

            <div className="relative">
              <SectionTitle
                icon="fixtures"
                title={
                  nextFixtureKind === "LIVE"
                    ? "Live Match"
                    : nextFixtureKind === "TODAY"
                      ? "Today's Match"
                      : nextFixtureKind === "POSTPONED"
                        ? "Match Status"
                        : nextFixtureKind === "PENDING"
                          ? "Pending Match"
                        : nextFixtureKind === "UNSCHEDULED"
                          ? "Fixture Ready"
                        : "Next Match"
                }
                href="/fixtures"
              />

              {nextFixture ? (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <FcStatusBadge
                      label={
                        nextFixtureKind === "LIVE"
                          ? "LIVE NOW"
                          : nextFixtureKind === "TODAY"
                            ? "TODAY"
                            : nextFixtureKind === "POSTPONED"
                              ? "POSTPONED"
                              : nextFixtureKind === "PENDING"
                                ? "AWAITING PLAY"
                              : nextFixtureKind === "UNSCHEDULED"
                                ? "SCHEDULE PENDING"
                              : "UPCOMING"
                      }
                      tone={
                        nextFixtureKind === "LIVE"
                          ? "red"
                          : nextFixtureKind === "POSTPONED"
                            ? "amber"
                            : nextFixtureKind === "TODAY"
                              ? "amber"
                              : "cyan"
                      }
                    />
                    <p className="theme-muted text-xs font-medium">
                      {nextFixture.tournamentName} · {nextFixture.roundName}
                    </p>
                  </div>

                  <div className="premium-match-sides mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5">
                    <FixtureTeamButton entry={nextFixture.home} name={entryName(nextFixture.home)} side="HOME" stacked size="lg" />

                    <div className={`theme-neutral-block grid h-12 w-12 place-items-center rounded-xl border text-xs font-semibold ${nextFixtureKind === "LIVE" ? "border-red-400/30 text-red-500" : ""}`}>
                      {nextFixtureKind === "LIVE" ? "LIVE" : "VS"}
                    </div>

                    <FixtureTeamButton entry={nextFixture.away} name={entryName(nextFixture.away)} side="AWAY" stacked size="lg" />
                  </div>

                  <div className="premium-match-footer mt-6 flex flex-col gap-3 border-t border-[var(--theme-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="theme-muted text-xs font-semibold">
                        {nextFixture.leagueName} · {nextFixture.matchday ? `Matchday ${nextFixture.matchday}` : nextFixture.roundName}
                      </p>

                      <p className="theme-secondary-text mt-1 text-sm font-medium">
                        {nextFixtureKind === "POSTPONED"
                          ? "Awaiting a new kickoff time"
                          : nextFixtureKind === "PENDING"
                            ? `Kickoff passed · result pending · ${formatFixtureDateTime(nextFixture.scheduledAt)}`
                          : nextFixtureKind === "UNSCHEDULED"
                            ? "Fixture generated · kickoff time pending"
                          : formatFixtureDateTime(nextFixture.scheduledAt)}
                      </p>

                      {nextFixtureKind === "UPCOMING" || nextFixtureKind === "TODAY" ? (
                        <p className="theme-warning-text mt-1 text-xs font-semibold">
                          {formatCountdown(nextFixture.scheduledAt, nowMs)}
                        </p>
                      ) : null}
                    </div>

                    <Link
                      href={
                        nextFixture.match?.id
                          ? `/matches/${nextFixture.match.id}`
                          : `/tournaments/${nextFixture.tournamentId}/fixtures`
                      }
                      className="theme-primary-button inline-flex min-h-12 items-center justify-center rounded-[10px] px-5 text-sm font-semibold"
                    >
                      {nextFixtureKind === "LIVE" ? "Open Live Match →" : "View Match →"}
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          </FcPanel> : null}

          {showLeague ? <FcPanel className="fc-league-panel p-5 sm:p-6">
            <SectionTitle
              icon="league"
              title="My League"
              href="/leagues"
              linkLabel="All Leagues →"
            />

            {selectedMembership ? (
              <>
                {memberships.length > 1 ? (
                  <div className="theme-soft-accent mt-5 rounded-xl border p-4">
                    <label
                      htmlFor="dashboard-league-context"
                      className="theme-text block text-xs font-semibold uppercase tracking-[0.12em]"
                    >
                      Dashboard league context
                    </label>

                    <select
                      id="dashboard-league-context"
                      aria-label="Dashboard league context"
                      value={selectedMembership.league.id}
                      onChange={(event) => setSelectedLeagueId(event.target.value)}
                      className="theme-input mt-2 min-h-11 w-full rounded-lg border px-3 text-sm font-semibold"
                    >
                      {memberships.map((membership) => (
                        <option key={membership.league.id} value={membership.league.id}>
                          {membership.league.name}
                        </option>
                      ))}
                    </select>

                    <p className="theme-muted mt-2 text-xs">
                      Match and tournament cards use the selected League.
                    </p>
                  </div>
                ) : null}

                <div className="mt-6 flex items-center gap-4">
                  <FcCrest
                    name={selectedMembership.league.name}
                    imageUrl={leagueLogo}
                    size="lg"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="theme-text truncate text-lg font-semibold">
                      {selectedMembership.league.name}
                    </h3>

                    <p className="theme-warning-text mt-1 font-mono text-xs font-semibold">
                      {selectedMembership.league.code}
                    </p>

                    <div className="mt-2">
                      <FcStatusBadge
                        label={selectedMembership.membershipType}
                        tone="cyan"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="fc-luxury-info rounded-xl p-3">
                    <p className="theme-muted text-xs">Region</p>

                    <p className="theme-text mt-1 truncate text-sm font-medium">
                      {selectedMembership.league.region || "Global"}
                    </p>
                  </div>

                  <div className="fc-luxury-info rounded-xl p-3">
                    <p className="theme-muted text-xs">Members</p>

                    <p className="theme-text mt-1 text-sm font-medium">
                      {selectedMembership.league.members}
                    </p>
                  </div>

                  <div className="fc-luxury-info rounded-xl p-3">
                    <p className="theme-muted text-xs">Role</p>

                    <p className="theme-text mt-1 truncate text-sm font-medium">
                      {selectedMembership.adminRole || "Player"}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/leagues/${selectedMembership.league.id}`}
                  className="theme-secondary-button mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border px-5 text-sm font-semibold transition"
                >
                  Open League →
                </Link>
              </>
            ) : null}
          </FcPanel> : null}
        </section>
        ) : null}

        <PlayerOnboarding userId={user.id} profile={hasProfile} league={!!primaryMembership} registered={career.tournamentHistory.length > 0} />

        {isVisible("activeTournament") && activeTournament ? <section className="fc-dashboard-section grid gap-5">
          <FcPanel className="fc-tournament-panel p-5 sm:p-6">
            <SectionTitle
              icon="tournament"
              title="Active Tournament"
              href="/tournaments"
            />

            {memberships.length > 1 ? <label className="mt-4 grid gap-2 text-xs font-semibold theme-muted">League
              <select aria-label="Active tournament league" value={selectedLeagueId} onChange={event => setSelectedLeagueId(event.target.value)}
                className="theme-field min-h-11 w-full rounded-xl border px-3 py-2 text-sm">
                {memberships.map(membership => <option key={membership.league.id} value={membership.league.id}>{membership.league.name}</option>)}
              </select>
            </label> : null}

            {activeTournament ? (
              <>
                <div className="mt-6 flex items-center gap-4">
                  <FcCrest
                    name={activeTournament.name}
                    imageUrl={activeTournament.logoUrl}
                    size="lg"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="theme-text truncate text-lg font-semibold">
                      {activeTournament.name}
                    </h3>
                    <p className="theme-secondary-text mt-1 break-words text-xs font-semibold">{activeTournament.leagueName || selectedMembership?.league.name} · {activeTournament.code}</p>

                    <p className="theme-muted mt-1 text-xs">
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
                    <span className="theme-muted">Approved places</span>

                    <span className="theme-secondary-text font-medium">
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
                <div className="mt-3"><TournamentRegistrationSummary tournament={activeTournament} /></div>

                {activeTournamentNextFixture ? (
                  <div className="mt-5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-secondary-background)] p-4">
                    <p className="theme-muted text-xs">Next fixture</p>

                    <div className="mt-2 grid gap-2 text-sm font-medium">
                      <p className="theme-text min-w-0 break-words">
                        <span className="theme-secondary-text mr-2 text-[11px] font-bold uppercase">Home</span>
                        {entryName(activeTournamentNextFixture.home)}
                      </p>
                      <p className="theme-text min-w-0 break-words">
                        <span className="theme-secondary-text mr-2 text-[11px] font-bold uppercase">Away</span>
                        {entryName(activeTournamentNextFixture.away)}
                      </p>
                    </div>
                  </div>
                ) : null}

                <Link
                  href={`/tournaments/${activeTournament.id}`}
                  className="theme-secondary-button mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border px-5 text-sm font-semibold transition"
                >
                  View Tournament →
                </Link>
              </>
            ) : null}
          </FcPanel>
        </section> : null}

        {emptyUpdates.length ? <section aria-label="Competition updates">
          <FcPanel className="home-empty-overview">
            {emptyUpdates.map(update => <Link key={update.key} href={update.href} className="home-empty-row">
              <span className="home-empty-icon theme-tone-neutral"><FcIcon name={update.icon} size={18} /></span>
              <span className="home-empty-copy"><span className="theme-text home-empty-title">{update.title}</span><span className="theme-muted">{update.description}</span></span>
              <span className="theme-text-link home-empty-action">{update.action} →</span>
            </Link>)}
          </FcPanel>
        </section> : null}

        <section aria-label="Career overview" className={`home-overview-stats fc-dashboard-stats grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 ${!isVisible("stats") ? "hidden" : ""}`}>
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

        <div className={`fc-quick-actions-panel ${!isVisible("quickActions") ? "hidden" : ""}`}>
          <SectionTitle icon="activity" title="Quick Actions" />

          <div className="home-core-actions mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FcQuickActionTile
              href="/leagues"
              icon="+"
              title={memberships.length ? "My Leagues" : "Join League"}
              description={memberships.length ? "Open your leagues" : "Use invite code"}
              tone="cyan"
            />

            <FcQuickActionTile
              href={createTournamentHref}
              icon="◇"
              title={isLeagueAdmin ? "Create Tournament" : "Tournaments"}
              description={
                isLeagueAdmin
                  ? "Start a new competition"
                  : "Browse competitions"
              }
              tone="emerald"
            />

            <FcQuickActionTile
              href="/fixtures"
              icon="fixtures"
              title="View Fixtures"
              description="Check upcoming matches"
              tone="slate"
            />

            <FcQuickActionTile
              href={
                selectedMembership
                  ? `/leaderboards?league=${selectedMembership.league.id}`
                  : "/leaderboards"
              }
              icon="activity"
              title="Leaderboard"
              description="View League performance rankings"
              tone="cyan"
            />

          </div>
          <details className="home-more-tools">
            <summary className="theme-secondary-text">More tools <span aria-hidden="true">⌄</span></summary>
            <div className="home-more-tools-grid grid grid-cols-2 gap-3 lg:grid-cols-3">
            <FcQuickActionTile
              href="/profile"
              icon="◎"
              title="Update Profile"
              description="Edit your information"
              tone="amber"
            />
              <FcQuickActionTile href="/awards" icon="trophy" title="Awards" description="Player honours and awards" tone="amber" />
              <FcQuickActionTile href="/league-war" icon="war" title="League War" description="League versus league" tone="cyan" />
            </div>
          </details>
        </div>
        <FcPanel className={`fc-activity-panel p-5 sm:p-6 ${!isVisible("activity") ? "hidden" : ""}`}>
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
                      <p className="theme-text truncate text-sm font-medium">
                        {activity.tournament.name}
                      </p>

                      <p className="theme-muted mt-1 truncate text-xs">
                        {activity.tournament.league.name}
                      </p>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <p className="theme-secondary-text text-sm font-semibold">
                      {activity.home.name}{" "}
                      <span className="theme-text">
                        {activity.home.score}-{activity.away.score}
                      </span>{" "}
                      {activity.away.name}
                    </p>

                    <p className="theme-muted mt-1 text-xs">
                      {new Date(activity.confirmedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-activity-empty">
              <p className="theme-text text-sm font-semibold">No recent activity</p>
              <p className="theme-muted text-sm">Verified match results will appear here.</p>
            </div>
          )}
        </FcPanel>
      </div>
    </AppShell>
  );
}
