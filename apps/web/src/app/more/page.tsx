"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRecoverableLoad } from '@/lib/use-recoverable-load';

import { AppShell } from "@/components/app/app-shell";

import {
  FcLoadingScreen,
  FcEmptyState,
  FcErrorState,
  FcMenuRow,
  FcPageHeader,
  FcPanel,
  FcStatusBadge,
} from "@/components/fc/fc-ui";

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
  logoutCurrentUser,
} from "@/lib/auth-client";

interface Membership {
  adminRole: "OWNER" | "ADMIN" | null;

  league: {
    id: string;
    name: string;
  };
}

interface NotificationData {
  unreadCount: number;
}

export default function MorePage() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [memberships, setMemberships] = useState<Membership[]>([]);

  const [unread, setUnread] = useState(0);

  const [loggingOut, setLoggingOut] = useState(false);
  const [search, setSearch] = useState("");

  const initialLoad = useRecoverableLoad(async signal => {
        const [current, leagues, notifications] = await Promise.all([
          getCurrentUser({ signal }),

          authenticatedRequest<{
            data: {
              leagues: Membership[];
            };
          }>("/leagues/my", { signal }),

          authenticatedRequest<{
            success: true;
            data: NotificationData;
            error: null;
          }>("/notifications?summary=true", { signal }).catch(() => ({
            success: true as const,

            data: {
              unreadCount: 0,
            },

            error: null,
          })),
        ]);

        if (signal.aborted) return;
        setUser(current);

        setMemberships(leagues.data.leagues);

        setUnread(notifications.data.unreadCount);
  });

  const isAdmin = useMemo(
    () => memberships.some((membership) => Boolean(membership.adminRole)),
    [memberships],
  );

  async function logout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await logoutCurrentUser();
    } catch {
      // Local auth is cleared even if the remote logout request fails.
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  if (initialLoad.error) return <AppShell><FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} /></AppShell>;
  if (!user) {
    return <AppShell><FcLoadingScreen label="Loading More..." embedded /></AppShell>;
  }

  const inGameName = user.player?.identity?.inGameName || user.fullName;
  const groups: { title: string; items: Parameters<typeof FcMenuRow>[0][] }[] = [
    { title: "Player essentials", items: [
      { href: "/experience", icon: "↗", title: "Player Journey", description: "Levels, weekly missions and your player card", tone: "amber" as const },
      { href: "/awards", icon: "🏆", title: "Awards & DUO/TEAM Honours", description: "Live Golden Boot races, official team trophies and Ballon d’Or", tone: "amber" as const },
      { href: "/clubs", icon: "★", title: "FC ARENA Clubs", description: "Permanent teams, members and verified history", tone: "amber" as const },
      { href: "/career/season-recaps", icon: "▥", title: "Season Recaps", description: "Verified results by official Ballon season", tone: "cyan" as const },
      { href: "/arena-talk", icon: "◉", title: "Arena Talk", description: "Your league conversations and the football community", tone: "cyan" as const },
      ...(user.role === "SUPER_ADMIN" ? [{ href: "/admin/community", icon: "◎", title: "Community Reports", description: "Review reported posts and comments" }] : []),
    ] },
    { title: "Competition Hubs", items: [
      { href: "/elite-cup", icon: "★", title: "Elite Cup", description: "Open Elite Cup competitions and league-phase playoffs", tone: "amber" as const },
      { href: "/ucl-cup", icon: "✦", title: "UCL Cup", description: "Open Champions League-style league phases and knockout finals", tone: "cyan" as const },
    ] },
    { title: "Career & Identity", items: [
      { href: "/profile", icon: "◎", title: "My Profile", description: "Player identity and account details" },
      { href: "/career", icon: "▥", title: "Career Stats", description: "Matches, wins, goals and form" },
      { href: "/career/matches", icon: "↺", title: "Match History", description: "Verified result history", tone: "emerald" as const },
      { href: "/career/achievements", icon: "★", title: "Achievements", description: "Trophies, awards and milestones", tone: "amber" as const },
    ] },
    { title: "Results & Records", items: [
      { href: "/matches", icon: "⚔", title: "Results", description: "Match result and verification center" },
      { href: "/leaderboards", icon: "≣", title: "Leaderboards", description: "League-wide performance across verified Tournaments" },
      { href: "/fair-play", icon: "◉", title: "Fair Play", description: "Your conduct score, event history and appeal rights", tone: "emerald" as const },
      { href: "/match-system", icon: "⚽", title: "Match System", description: "Fixture and match workflow guide" },
    ] },
    { title: "People & Activity", items: [
      { href: "/discover", icon: "search", title: "Discover", description: "Search players, Leagues, Tournaments and Ballon seasons", tone: "cyan" as const },
      { href: "/awards/hall-of-fame", icon: "🏆", title: "Hall of Fame", description: "Ballon champions, podiums and historic FC Arena honours", tone: "amber" as const },
      { href: "/community/teams", icon: "◈", title: "Teams", description: "Teams from your current League competitions" },
      { href: "/community/invitations", icon: "+", title: "Invitations & Join Requests", description: "League membership request access" },
      { href: "/notifications", icon: "●", title: "Notifications", description: "Competition and system activity", badge: unread > 0 ? unread : undefined },
      { href: "/announcements", icon: "⌁", title: "Announcements", description: "Community notice area", tone: "slate" as const },
    ] },
    ...(isAdmin ? [{ title: "Admin", items: [
      { href: "/admin/analytics", icon: "↗", title: "Admin Analytics", description: "Operational metrics, competition load and audit activity", tone: "cyan" as const },
      ...(user.role === "SUPER_ADMIN" ? [{ href: "/admin/system", icon: "◉", title: "System Monitoring", description: "API, database, push delivery and backup health", tone: "emerald" as const }, { href: "/admin/android", icon: "⚙", title: "Android Releases", description: "Play versionCodes, release channels and update policy", tone: "amber" as const }] : []),
      { href: "/admin/leagues", icon: "⚙", title: "League Management", description: "Members, applications and League controls", tone: "amber" as const },
      { href: "/admin/tournaments", icon: "◇", title: "Tournament Management", description: "Competition setup and administration", tone: "amber" as const },
      { href: "/admin/teams", icon: "◎", title: "Team Management", description: "Tournament team administration", tone: "amber" as const },
      { href: "/admin/results", icon: "✓", title: "Result Verification", description: "Match results and verification workflow", tone: "emerald" as const },
      { href: "/admin/disputes", icon: "!", title: "Disputes", description: "Match-level dispute access", tone: "red" as const },
      { href: "/admin/fair-play", icon: "◉", title: "Fair Play Management", description: "Conduct events, fixed policy points and player appeals", tone: "amber" as const },
    ] } satisfies { title: string; items: Parameters<typeof FcMenuRow>[0][] }] : []),
    { title: "App & Support", items: [
      { href: "/ai", icon: "✦", title: "FC ARENA AI", description: "Read-only help, match context and stats assistant", tone: "cyan" as const },
      { href: "/settings", icon: "⚙", title: "Settings", description: "Account and app preferences" },
      { href: "/safety", icon: "!", title: "Safety & Reporting", description: "Report inappropriate content, block players and manage community safety", tone: "red" as const },
      { href: "/privacy", icon: "◉", title: "Privacy", description: "Privacy and account data information" },
      { href: "/account-deletion", icon: "!", title: "Delete Account & Data", description: "Request permanent deletion of your FC ARENA account and associated personal data", tone: "red" as const },
      { href: "/terms", icon: "document", title: "Terms of Service", description: "Platform use, competition and account terms", tone: "slate" as const },
      { href: "/help", icon: "?", title: "Help", description: "Get help with FC ARENA workflows" },
      { href: "/about", icon: "i", title: "About", description: "Platform information and version", tone: "slate" as const },
    ] },
  ];
  const query = search.trim().toLocaleLowerCase();
  const results = groups.flatMap(group => group.items.filter(item =>
    [item.title, item.description, group.title].some(value => value.toLocaleLowerCase().includes(query)),
  ));


  return (
    <AppShell playerName={inGameName}>
      <div className="fc-more-page space-y-6">
        <FcPageHeader
          icon="more"
          eyebrow="YOUR FC ARENA"
          title={"More"}
          subtitle="Profile, career, community and account tools."
          action={
            <FcStatusBadge
              label={isAdmin ? "Admin Access" : "Player Access"}
              tone={isAdmin ? "amber" : "cyan"}
            />
          }
        />

        <FcPanel className="p-5">
          <div className="flex items-center gap-4">
            <div className="theme-soft-accent grid h-11 w-11 place-items-center rounded-xl border text-sm font-semibold">
              {inGameName.slice(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="theme-text font-semibold [overflow-wrap:anywhere]">{inGameName}</p>

              <p className="theme-secondary-text mt-1 break-all font-mono text-[11px]">
                {user.player?.playerCode || "FC ARENA Player"}
              </p>
            </div>
            <Link href="/profile" className="theme-secondary-button inline-flex min-h-11 shrink-0 items-center rounded-xl border px-3 text-xs font-semibold">Profile</Link>
          </div>
        </FcPanel>

        <FcPanel className="p-4">
          <label className="theme-text grid gap-2 text-sm font-semibold">
            Find a feature
            <input type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Search profile, competitions, settings…" className="theme-input min-h-11 min-w-0 w-full rounded-xl border px-3 font-normal" />
          </label>
          {query ? <div className="mt-2 flex items-center justify-between gap-2">
            <p role="status" className="theme-secondary-text text-xs">{results.length} matching features</p>
            <button type="button" onClick={() => setSearch("")} className="theme-secondary-button min-h-11 rounded-lg border px-3 text-xs">Clear search</button>
          </div> : null}
        </FcPanel>

        {query ? (
          <section aria-label="Feature search results" className="grid gap-3 sm:grid-cols-2">
            {results.length ? results.map(item => <FcMenuRow key={item.href} {...item} />) :
              <FcEmptyState title="No matching features" description="Try a different feature name or clear the search." />}
          </section>
        ) : groups.map((group, index) => index === 0 ? (
          <section key={group.title} aria-label={group.title}>
            <h2 className="theme-text mb-3 text-base font-semibold">{group.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">{group.items.map(item => <FcMenuRow key={item.href} {...item} />)}</div>
          </section>
        ) : (
          <details key={group.title} className="theme-panel rounded-2xl p-4" open={index === 1 ? true : undefined}>
            <summary className="theme-text min-h-11 cursor-pointer font-semibold">{group.title}</summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2">{group.items.map(item => <FcMenuRow key={item.href} {...item} />)}</div>
            {group.title === "App & Support" ? (
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void logout()}
            className="theme-danger-button mt-4 min-h-11 w-full rounded-[10px] border px-4 text-sm font-semibold transition disabled:opacity-50"
          >
            {loggingOut ? "Signing Out..." : "Logout"}
          </button>
            ) : null}
          </details>
        ))}

      </div>
    </AppShell>
  );
}
