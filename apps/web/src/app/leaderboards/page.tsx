"use client";

import { useEffect, useState } from "react";

import {
  FcCrest,
  FcEmptyState,
  FcErrorState,
  FcPanel,
  FcStatCard,
} from "@/components/fc/fc-ui";

import { SecondaryFeaturePage } from "@/components/fc/secondary-feature-page";

import { authenticatedRequest, getCurrentUser } from "@/lib/auth-client";

interface Membership {
  membershipType: "PRIMARY" | "SECONDARY";

  league: {
    id: string;
    name: string;
  };
}

interface RankingRow {
  position: number;
  rankChange?: number | null;
  userId: string;
  fullName: string;
  playerCode: string | null;
  inGameName: string | null;
  profileImageUrl: string | null;
  tournamentsPlayed: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
  performancePoints: number;
  form: string;
}

interface LeaderboardData {
  league: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    region: string | null;
  };

  filter: {
    mode: "SOLO" | "DUO" | "TEAM" | null;
  };

  summary: {
    members: number;
    rankedPlayers: number;
    tournaments: number;
    verifiedMatches: number;
    lastUpdatedAt: string | null;
    comparisonCapturedAt?: string | null;
  };

  myPosition: number | null;
  rankings: RankingRow[];
}

function playerName(row: RankingRow) {
  return row.inGameName || row.fullName;
}

function formTone(outcome: string) {
  if (outcome === "W") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }

  if (outcome === "D") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  }

  return "border-red-400/20 bg-red-400/10 text-red-300";
}

export default function LeaderboardsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);

  const [selectedLeague, setSelectedLeague] = useState("");

  const [mode, setMode] = useState("");

  const [data, setData] = useState<LeaderboardData | null>(null);

  const [userId, setUserId] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [current, leagues] = await Promise.all([
          getCurrentUser(),

          authenticatedRequest<{
            success: true;

            data: {
              leagues: Membership[];
            };

            error: null;
          }>("/leagues/my"),
        ]);

        const list = leagues.data.leagues;

        const requestedLeague = new URLSearchParams(window.location.search).get(
          "league",
        );

        const initialLeague =
          requestedLeague &&
          list.some((membership) => membership.league.id === requestedLeague)
            ? requestedLeague
            : (list.find(
                (membership) => membership.membershipType === "PRIMARY",
              )?.league.id ??
              list[0]?.league.id ??
              "");

        setUserId(current.id);

        setMemberships(list);

        setSelectedLeague(initialLeague);

        if (!initialLeague) {
          setLoading(false);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load Leaderboards.",
        );

        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedLeague) {
      return;
    }

    setLoading(true);

    setData(null);

    const suffix = mode ? "?mode=" + encodeURIComponent(mode) : "";

    void authenticatedRequest<{
      success: true;
      data: LeaderboardData;
      error: null;
    }>("/leagues/" + selectedLeague + "/rankings" + suffix)
      .then((response) => {
        setData(response.data);

        setError("");
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Unable to load Leaderboard.",
        );

        setData(null);
      })
      .finally(() => setLoading(false));
  }, [selectedLeague, mode]);

  const rankings = data?.rankings ?? [];

  const myPosition =
    data?.myPosition ??
    rankings.find((row) => row.userId === userId)?.position ??
    null;

  const podiumRows = [rankings[1], rankings[0], rankings[2]].filter(
    (row): row is RankingRow => Boolean(row),
  );

  return (
    <SecondaryFeaturePage
      eyebrow="Competition"
      title="League Leaderboards"
      subtitle="League-wide player performance combined automatically from verified FC ARENA Tournament results."
      backHref={selectedLeague ? "/leagues/" + selectedLeague : "/more"}
      backLabel={selectedLeague ? "League" : "More"}
      action={
        myPosition ? (
          <button className="theme-secondary-button rounded-lg px-4 py-2" onClick={() => { const targets = document.querySelectorAll(`[data-player-id="${userId}"]`); const target = Array.from(targets).find(el => (el as HTMLElement).offsetParent !== null); target?.scrollIntoView({block:"center",behavior:"smooth"}); }}>Find my rank · #{myPosition}</button>
        ) : null
      }
    >
      {error ? <FcErrorState message={error} /> : null}

      {memberships.length === 0 && !loading ? (
        <FcEmptyState
          title="Join a League first"
          description="A League Leaderboard becomes available after you join an FC ARENA League."
          actionLabel="Open Leagues"
          actionHref="/leagues"
        />
      ) : (
        <>
          <FcPanel className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                <span className="theme-muted">League</span>

                <select
                  value={selectedLeague}
                  onChange={(event) => setSelectedLeague(event.target.value)}
                  className="theme-input min-h-11 rounded-xl border px-3 outline-none"
                >
                  {memberships.map((membership) => (
                    <option
                      key={membership.league.id}
                      value={membership.league.id}
                    >
                      {membership.league.name}
                      {membership.membershipType === "PRIMARY"
                        ? " · Primary"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium">
                <span className="theme-muted">Competition mode</span>

                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className="theme-input min-h-11 rounded-xl border px-3 outline-none"
                >
                  <option value="">All Tournaments</option>

                  <option value="SOLO">Solo</option>

                  <option value="DUO">Duo</option>

                  <option value="TEAM">Team</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Leaderboard scoring rules">
              {[
                ["Win", "+3"],
                ["Draw", "+1"],
                ["Loss", "+0"],
                ["Results", "Verified"],
              ].map(([label, value]) => (
                <div key={label} className="theme-soft-accent rounded-xl border px-2 py-2 text-center">
                  <p className="theme-muted text-[9px] font-semibold uppercase tracking-[0.08em] sm:text-[10px]">
                    {label}
                  </p>
                  <p className="theme-text mt-1 text-xs font-black sm:text-sm">{value}</p>
                </div>
              ))}
            </div>
          </FcPanel>

          {loading ? (
            <FcPanel className="p-8 text-center">
              <p className="theme-secondary-text text-sm">
                Calculating League performance...
              </p>
            </FcPanel>
          ) : data ? (
            <>
              <FcPanel className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <FcCrest
                      name={data.league.name}
                      imageUrl={data.league.logoUrl}
                      size="lg"
                    />

                    <div>
                      <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-sky-400">
                        {data.league.code}
                      </p>

                      <h2 className="theme-text mt-1 text-xl font-semibold">
                        {data.league.name}
                      </h2>

                      <p className="theme-muted mt-1 text-xs">
                        {data.league.region || "FC ARENA League"}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="theme-muted text-[10px] uppercase tracking-[0.14em]">
                      Last stats update
                    </p>

                    <p className="theme-secondary-text mt-1 text-xs">
                      {data.summary.lastUpdatedAt
                        ? new Date(data.summary.lastUpdatedAt).toLocaleString()
                        : "Waiting for verified results"}
                    </p>
                  </div>
                </div>
              </FcPanel>

              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <FcStatCard
                  label="Ranked Players"
                  value={data.summary.rankedPlayers}
                  detail={`${data.summary.members} League members`}
                />

                <FcStatCard
                  label="Tournaments"
                  value={data.summary.tournaments}
                  detail={mode ? mode + " mode" : "All modes"}
                  tone="amber"
                />

                <FcStatCard
                  label="Verified Matches"
                  value={data.summary.verifiedMatches}
                  detail="Confirmed results only"
                  tone="emerald"
                />

                <FcStatCard
                  label="Your Rank"
                  value={myPosition ? "#" + myPosition : "—"}
                  detail={
                    myPosition ? "League position" : "Play a verified match"
                  }
                  tone="slate"
                />
              </section>

              <p className="theme-muted text-sm">{data.summary.comparisonCapturedAt ? `Rank movement since saved snapshot: ${new Date(data.summary.comparisonCapturedAt).toLocaleString()}` : "Rank history starts with today’s saved table. Movement appears after a later day’s visit."}</p>
              {rankings.length === 0 ? (
                <FcEmptyState
                  title="No ranking data yet"
                  description="Once a Tournament match result is verified, player performance will be added to this League Leaderboard automatically."
                />
              ) : (
                <>
                  <section className="hidden grid-cols-3 items-end gap-3 md:grid" aria-label="Top three players">
                    {podiumRows.map((row) => {
                      const champion = row.position === 1;

                      return (
                        <FcPanel
                          key={row.userId}
                          className={
                            "relative overflow-hidden p-5 text-center " +
                            (champion
                              ? "min-h-[250px] border-amber-400/25 theme-soft-accent"
                              : "min-h-[220px]")
                          }
                        >
                          <span
                            className={
                              "mx-auto grid h-10 w-10 place-items-center rounded-full border text-sm font-black " +
                              (champion
                                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                                : "theme-tone-premium")
                            }
                          >
                            #{row.position}
                          </span>

                          <div className="mt-3 flex justify-center">
                            <FcCrest
                              name={playerName(row)}
                              imageUrl={row.profileImageUrl}
                              size="sm"
                            />
                          </div>

                          <h2 className="theme-text mt-3 truncate text-base font-bold">
                            {playerName(row)}
                          </h2>

                          <p className="theme-text-link mt-3 text-3xl font-black">
                            {row.performancePoints}
                          </p>
                          <p className="theme-muted text-[9px] font-semibold uppercase tracking-[0.1em]">
                            points
                          </p>

                          <div className="mt-3 grid grid-cols-2 gap-1 text-center">
                            <div className="theme-soft-accent rounded-lg border px-1 py-1.5">
                              <p className="theme-muted text-[9px]">W</p>
                              <p className="theme-text text-xs font-bold">{row.wins}</p>
                            </div>
                            <div className="theme-soft-accent rounded-lg border px-1 py-1.5">
                              <p className="theme-muted text-[9px]">WIN%</p>
                              <p className="theme-text text-xs font-bold">{row.winRate}%</p>
                            </div>
                          </div>

                          {row.rankChange != null ? (
                            <p className="theme-muted mt-2 text-[10px]">
                              {row.rankChange > 0
                                ? `↑ ${row.rankChange} places`
                                : row.rankChange < 0
                                  ? `↓ ${Math.abs(row.rankChange)} places`
                                  : "No rank change"}
                            </p>
                          ) : null}
                        </FcPanel>
                      );
                    })}
                  </section>

                  <section className="grid gap-3 md:hidden" aria-label="Top three players">
                    {rankings.slice(0, 3).map((row) => {
                      const champion = row.position === 1;

                      return (
                        <FcPanel
                          key={row.userId}
                          className={
                            "relative overflow-hidden p-4 " +
                            (champion
                              ? "border-amber-400/25 theme-soft-accent"
                              : "")
                          }
                        >
                          <div
                            data-player-id={row.userId}
                            className="flex min-w-0 items-center gap-3"
                          >
                            <span
                              className={
                                "grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-sm font-black " +
                                (champion
                                  ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                                  : "theme-tone-premium")
                              }
                            >
                              #{row.position}
                            </span>

                            <FcCrest
                              name={playerName(row)}
                              imageUrl={row.profileImageUrl}
                              size="sm"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="theme-text min-w-0 truncate text-base font-bold">
                                  {playerName(row)}
                                </p>
                                {champion ? (
                                  <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-amber-300">
                                    Leader
                                  </span>
                                ) : null}
                              </div>
                              <p className="theme-muted mt-1 truncate text-[10px]">
                                {row.tournamentsPlayed} tournaments · {row.matches} matches
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="theme-text-link text-xl font-black leading-none">
                                {row.performancePoints}
                              </p>
                              <p className="theme-muted mt-1 text-[9px] font-semibold uppercase tracking-[0.08em]">
                                pts
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <div className="theme-soft-accent rounded-lg border px-2 py-2">
                              <p className="theme-muted text-[9px] uppercase tracking-[0.08em]">
                                Wins
                              </p>
                              <p className="theme-text mt-1 text-sm font-black">
                                {row.wins}
                              </p>
                            </div>
                            <div className="theme-soft-accent rounded-lg border px-2 py-2">
                              <p className="theme-muted text-[9px] uppercase tracking-[0.08em]">
                                Win %
                              </p>
                              <p className="theme-text mt-1 text-sm font-black">
                                {row.winRate}%
                              </p>
                            </div>
                            <div className="theme-soft-accent rounded-lg border px-2 py-2">
                              <p className="theme-muted text-[9px] uppercase tracking-[0.08em]">
                                GD
                              </p>
                              <p className="theme-text mt-1 text-sm font-black">
                                {row.goalDifference > 0
                                  ? "+" + row.goalDifference
                                  : row.goalDifference}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="theme-muted text-[10px]">
                              {row.rankChange == null
                                ? "No previous rank"
                                : row.rankChange > 0
                                  ? `↑ ${row.rankChange} places`
                                  : row.rankChange < 0
                                    ? `↓ ${Math.abs(row.rankChange)} places`
                                    : "No rank change"}
                            </p>
                            <p className="theme-muted text-[10px]">
                              {row.goalsFor} GF · {row.goalsAgainst} GA
                            </p>
                          </div>
                        </FcPanel>
                      );
                    })}
                  </section>

                  <div className="grid gap-3 md:hidden">
                    {rankings.slice(3).map((row) => (
                      <FcPanel
                        key={row.userId}
                        className={
                          "p-4 " +
                          (row.userId === userId ? "theme-soft-accent" : "")
                        }
                      >
                        <div data-player-id={row.userId} className="flex items-center gap-3">
                          <span className="theme-tone-premium grid h-10 min-w-10 place-items-center rounded-xl border px-2 font-bold">
                            #{row.position}
                            <span className="ml-1 text-xs" aria-label={row.rankChange == null ? "No previous rank" : `Rank change ${row.rankChange}`}>{row.rankChange == null ? "" : row.rankChange > 0 ? `↑${row.rankChange}` : row.rankChange < 0 ? `↓${Math.abs(row.rankChange)}` : "—"}</span>
                          </span>

                          <FcCrest
                            name={playerName(row)}
                            imageUrl={row.profileImageUrl}
                            size="sm"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="theme-text truncate font-semibold">
                              {playerName(row)}
                            </p>

                            <p className="theme-muted mt-0.5 text-[10px]">
                              {row.tournamentsPlayed} tournaments ·{" "}
                              {row.matches} matches
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="theme-text-link font-bold">
                              {row.performancePoints} pts
                            </p>

                            <p className="theme-muted mt-0.5 text-[10px]">
                              {row.winRate}% win
                            </p>
                          </div>
                        </div>

                         <details className="fc-row-details"><summary>Statistics &amp; recent form</summary>
                         <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          {[
                            ["W", row.wins],
                            ["D", row.draws],
                            ["L", row.losses],
                            ["GF", row.goalsFor],
                            ["GA", row.goalsAgainst],
                            [
                              "GD",
                              row.goalDifference > 0
                                ? "+" + row.goalDifference
                                : row.goalDifference,
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="theme-soft-accent rounded-lg border px-2 py-2.5"
                            >
                              <p className="theme-muted text-xs">{label}</p>

                              <p className="theme-text mt-1 text-xs font-bold">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>

                        {row.form ? (
                          <div className="mt-3 flex items-center gap-1.5">
                            <span className="theme-muted mr-1 text-xs uppercase tracking-[0.12em]">
                              Form
                            </span>

                            {row.form.split("").map((outcome, index) => (
                              <span
                                key={outcome + index}
                                className={
                                  "grid h-6 w-6 place-items-center rounded-md border text-xs font-bold " +
                                  formTone(outcome)
                                }
                              >
                                {outcome}
                              </span>
                            ))}
                          </div>
                         ) : null}
                         </details>
                       </FcPanel>
                    ))}
                  </div>

                  <FcPanel className="hidden overflow-hidden md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead className="theme-soft-accent text-left">
                          <tr className="theme-muted">
                            <th className="px-4 py-3">Rank</th>

                            <th className="px-4 py-3">Player</th>

                            <th className="px-3 py-3 text-center">T</th>

                            <th className="px-3 py-3 text-center">MP</th>

                            <th className="px-3 py-3 text-center">W</th>

                            <th className="px-3 py-3 text-center">D</th>

                            <th className="px-3 py-3 text-center">L</th>

                            <th className="px-3 py-3 text-center">GF</th>

                            <th className="px-3 py-3 text-center">GA</th>

                            <th className="px-3 py-3 text-center">GD</th>

                            <th className="px-3 py-3 text-center">Win %</th>

                            <th className="px-4 py-3 text-center">
                              Performance
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {rankings.map((row) => (
                            <tr
                              data-player-id={row.userId}
                              key={row.userId}
                              className={
                                "border-t theme-divider " +
                                (row.userId === userId
                                  ? "theme-soft-accent"
                                  : "")
                              }
                            >
                              <td className="theme-text px-4 py-3 font-bold">
                                #{row.position}
                            <span className="ml-1 text-xs" aria-label={row.rankChange == null ? "No previous rank" : `Rank change ${row.rankChange}`}>{row.rankChange == null ? "" : row.rankChange > 0 ? `↑${row.rankChange}` : row.rankChange < 0 ? `↓${Math.abs(row.rankChange)}` : "—"}</span>
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <FcCrest
                                    name={playerName(row)}
                                    imageUrl={row.profileImageUrl}
                                    size="sm"
                                  />

                                  <div className="min-w-0">
                                    <p className="theme-text truncate font-semibold">
                                      {playerName(row)}
                                    </p>

                                    <p className="theme-muted mt-0.5 text-xs">
                                      {row.playerCode || row.fullName}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3 text-center">
                                {row.tournamentsPlayed}
                              </td>

                              <td className="px-3 py-3 text-center">
                                {row.matches}
                              </td>

                              <td className="px-3 py-3 text-center">
                                {row.wins}
                              </td>

                              <td className="px-3 py-3 text-center">
                                {row.draws}
                              </td>

                              <td className="px-3 py-3 text-center">
                                {row.losses}
                              </td>

                              <td className="px-3 py-3 text-center">
                                {row.goalsFor}
                              </td>

                              <td className="px-3 py-3 text-center">
                                {row.goalsAgainst}
                              </td>

                              <td className="px-3 py-3 text-center">
                                {row.goalDifference > 0
                                  ? "+" + row.goalDifference
                                  : row.goalDifference}
                              </td>

                              <td className="px-3 py-3 text-center">
                                {row.winRate}%
                              </td>

                              <td className="theme-text-link px-4 py-3 text-center font-bold">
                                {row.performancePoints} pts
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </FcPanel>
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </SecondaryFeaturePage>
  );
}
