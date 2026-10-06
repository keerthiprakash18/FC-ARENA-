"use client";

import { LeagueInvite } from "@/components/fc/league-invite";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/app-shell";

import { PremiumHero } from "@/components/fc/premium-ui";
import { FcIcon, iconNameFromLegacy } from "@/components/fc/fc-icons";

import {
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
} from "@/components/fc/fc-ui";

import { LeagueNavigation } from "@/components/leagues/league-navigation";

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from "@/lib/auth-client";

interface LeagueHome {
  id: string;
  name: string;
  logoUrl?: string | null;
  code: string;
  description: string | null;
  region: string | null;
  rules: string | null;
  members: number;
  maxMembers: number;
  pendingApplications: number;
  membershipType: "PRIMARY" | "SECONDARY";
  adminRole: "OWNER" | "ADMIN" | null;

  creator: {
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
  };
}

interface TournamentSummary {
  id: string;
  status: string;
}

export default function LeagueOverviewPage() {
  const { leagueId } = useParams<{
    leagueId: string;
  }>();

  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [league, setLeague] = useState<LeagueHome | null>(null);

  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [current, leagueResponse, tournamentResponse] = await Promise.all(
          [
            getCurrentUser(),

            authenticatedRequest<{
              success: true;
              data: {
                league: LeagueHome;
              };
              error: null;
            }>(`/leagues/${leagueId}`),

            authenticatedRequest<{
              success: true;
              data: {
                tournaments: TournamentSummary[];
              };
              error: null;
            }>(`/leagues/${leagueId}/tournaments`),
          ],
        );

        setUser(current);

        setLeague(leagueResponse.data.league);

        setTournaments(tournamentResponse.data.tournaments);
      } catch {
        router.replace("/leagues");
      }
    }

    void load();
  }, [leagueId, router]);

  if (!user || !league) {
    return <FcLoadingScreen label="Loading League Overview..." />;
  }

  const activeTournaments = tournaments.filter(
    (tournament) => !["COMPLETED", "CANCELLED"].includes(tournament.status),
  ).length;

  return (
    <AppShell playerName={user.player?.identity?.inGameName}>
      <div className="premium-page premium-league-hub">
        <Link href="/leagues" className="premium-quiet">← My Leagues</Link>
        <PremiumHero
          eyebrow={`League hub · ${league.region || "Global"}`}
          title={league.name}
          description={league.description || "Your club. Your players. Your competition."}
          crest={league.name}
          imageUrl={league.logoUrl}
          action={<Link href={`/leagues/${leagueId}/tournaments`} className="theme-primary-button premium-button">Open Tournaments <FcIcon name="chevronRight" size={16} /></Link>}
        ><div className="premium-hero-tags"><span>{league.members} / {league.maxMembers} members</span><span>{league.membershipType}</span><span>{league.adminRole || "Player"}</span><span>{activeTournaments} active tournaments</span><span>{league.code}</span></div></PremiumHero>

        <LeagueNavigation leagueId={leagueId} />

        <section className="premium-metrics" aria-label="League summary">
          <FcStatCard
            label="Members"
            value={league.members}
            detail={`Max ${league.maxMembers}`}
          />

          <FcStatCard
            label="Active Tournaments"
            value={activeTournaments}
            detail={`${tournaments.length} total`}
            tone="emerald"
          />

          <FcStatCard
            label="Pending Requests"
            value={league.pendingApplications}
            detail={league.adminRole ? "Admin review" : "League applications"}
            tone="amber"
          />

          <FcStatCard
            label="Your Role"
            value={league.adminRole || "PLAYER"}
            detail={league.membershipType}
            tone="slate"
          />
        </section>

        <section className="premium-hub-links" aria-label="League destinations">
          {[
            [
              "Tournaments",
              "Create and manage competitions",
              `/leagues/${leagueId}/tournaments`,
              "◇",
            ],
            [
              "Leaderboards",
              "League-wide player performance across verified Tournaments",
              `/leaderboards?league=${leagueId}`,
              "★",
            ],
            [
              "Standings",
              "Tournament-by-Tournament standings tables",
              `/leagues/${leagueId}/standings`,
              "≣",
            ],
            [
              "Fixtures",
              "All matches from this League",
              `/leagues/${leagueId}/fixtures`,
              "⚽",
            ],
            [
              "Members",
              "Players and member management",
              `/leagues/${leagueId}/members`,
              "◎",
            ],
            [
              "Teams",
              "Tournament teams in this League",
              `/leagues/${leagueId}/teams`,
              "◈",
            ],
            [
              "Settings",
              league.adminRole
                ? "Applications and League controls"
                : "Membership and League information",
              `/leagues/${leagueId}/settings`,
              "⚙",
            ],
          ].map(([title, description, href, icon]) => (
            <Link
              key={title}
              href={href}
              className={title === "Tournaments" ? "premium-destination is-featured" : "premium-destination"}
            >
              <FcIcon name={iconNameFromLegacy(icon)} size={24} />
              <span><strong>{title}</strong><span>{description}</span></span>
              <FcIcon name="chevronRight" size={18} />
            </Link>
          ))}
        </section>
        <LeagueInvite code={league.code} name={league.name} />

        <FcPanel className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
            League Owner
          </p>

          <p className="mt-2 font-black">{league.creator.fullName}</p>

          <p className="mt-1 text-sm text-sky-300">
            {league.creator.inGameName || "No in-game name"}
          </p>
        </FcPanel>
      </div>
    </AppShell>
  );
}
