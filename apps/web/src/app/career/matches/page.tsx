"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/app-shell";
import { BackHeader } from "@/components/app/back-header";
import { CareerNavigation } from "@/components/career/career-navigation";
import {
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from "@/components/fc/fc-ui";

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from "@/lib/auth-client";

interface MatchHistory {
  id: string;
  matchCode: string | null;
  outcome: "W" | "D" | "L";
  opponent?: {key: string; name: string};
  confirmedAt: string;

  tournament: {
    id: string;
    name: string;
    league: {
      id: string;
      name: string;
    };
  };

  fixture: {
    roundName: string;
    matchday: number | null;
  };

  home: {
    name: string;
    score: number;
  };

  away: {
    name: string;
    score: number;
  };
}

interface CareerData {
  profile: {
    fullName: string;
    identity: {
      inGameName: string;
    } | null;
  };

  matchHistory: MatchHistory[];
}

export default function CareerMatchesPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [career, setCareer] = useState<CareerData | null>(null);

  const [opponent, setOpponent] = useState("ALL");
  const [season, setSeason] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const [current, response] = await Promise.all([
        getCurrentUser(),
        authenticatedRequest<{
          success: true;
          data: CareerData;
          error: null;
        }>("/players/me/career"),
      ]);

      setUser(current);
      setCareer(response.data);
    })().catch(() => setError("Unable to load match history. Please retry."));
  }, []);

  if (error) return <AppShell><FcErrorState message={error} onRetry={() => window.location.reload()} /></AppShell>;
  if (!user || !career) {
    return <FcLoadingScreen label="Loading Match History..." />;
  }

  const playerName =
    career.profile.identity?.inGameName || career.profile.fullName;

  const years = [...new Set(career.matchHistory.map(match => new Date(match.confirmedAt).getFullYear()))].sort((a,b) => b-a);
  const opponents = [...new Map(career.matchHistory.filter(match => match.opponent?.key).map(match => [match.opponent!.key, match.opponent!.name])).entries()];
  const filtered = career.matchHistory.filter(match => (opponent === "ALL" || match.opponent?.key === opponent) && (season === "ALL" || String(new Date(match.confirmedAt).getFullYear()) === season) && `${match.home.name} ${match.away.name} ${match.tournament.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return (
    <AppShell playerName={playerName}>
      <div className="space-y-6">
        <BackHeader
          backHref="/career"
          backLabel="Career Stats"
          eyebrow="Player Career"
          title="Match History"
          subtitle="Verified match-by-match results only."
        />

        <CareerNavigation />
        <FcPanel className="grid gap-4 p-4 sm:grid-cols-2"><label className="fc-field-label">Year archive<select className="theme-secondary-button p-3" value={season} onChange={event=>setSeason(event.target.value)}><option value="ALL">All years</option>{years.map(year=><option key={year} value={year}>{year}</option>)}</select></label><label className="fc-field-label">Find a team or tournament<input className="theme-secondary-button p-3" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search verified history" /></label><label className="fc-field-label sm:col-span-2">Head-to-head · verified opponents<select value={opponent} onChange={event=>setOpponent(event.target.value)} className="theme-secondary-button p-3"><option value="ALL">All opponents</option>{opponents.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><p className="text-sm sm:col-span-2">{filtered.length} verified matches · {filtered.filter(m=>m.outcome==="W").length} W · {filtered.filter(m=>m.outcome==="D").length} D · {filtered.filter(m=>m.outcome==="L").length} L</p></FcPanel>

        {filtered.length === 0 ? (
          <FcEmptyState
            title="No verified matches yet"
            description="Completed and verified Match results will appear here."
            actionLabel="Open Match Center"
            actionHref="/matches"
          />
        ) : (
          <section className="grid gap-3">
            {filtered.map((match) => (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                className="group"
              >
                <FcPanel className="p-5 transition group-hover:border-sky-400/25">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <FcStatusBadge
                        label={match.outcome}
                        tone={
                          match.outcome === "W"
                            ? "emerald"
                            : match.outcome === "D"
                              ? "amber"
                              : "red"
                        }
                      />

                      <div>
                        <p className="font-black">{match.tournament.name}</p>

                        <p className="mt-1 text-xs text-slate-600">
                          {match.fixture.roundName}
                          {" · "}
                          {match.tournament.league.name}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-lg font-black">
                        {match.home.name}{" "}
                        <span className="text-sky-300">
                          {match.home.score}-{match.away.score}
                        </span>{" "}
                        {match.away.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        {new Date(match.confirmedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </FcPanel>
              </Link>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
