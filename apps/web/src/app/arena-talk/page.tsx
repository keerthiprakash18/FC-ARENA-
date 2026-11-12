"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { ArenaFeed } from "@/components/arena/arena-feed";
import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth-client";
import { errorMessage, type ApiData } from "@/lib/player-experience";
import type { ArenaContext } from "@/lib/arena-talk";
import { FcErrorState, FcLoadingScreen, FcPageHeader } from "@/components/fc/fc-ui";
import { confirmAction } from "@/components/fc/confirmation-provider";
export default function ArenaTalkPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [context, setContext] = useState<ArenaContext | null>(null);
  const [scope, setScope] = useState("PUBLIC");
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const [u, c] = await Promise.all([
        getCurrentUser(),
        authenticatedRequest<ApiData<ArenaContext>>("/arena-talk/context"),
      ]);
      setUser(u);
      setContext(c.data);
      const initial = new URLSearchParams(window.location.search).get(
        "leagueId",
      );
      if (initial && c.data.leagues.some((l) => l.id === initial))
        setScope(initial);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function switchScope(next: string) {
    if (next === scope) return;
    const draft = document.querySelector<HTMLTextAreaElement>("#arena-body");
    if (
      draft?.value.trim() &&
      !(await confirmAction({
        title: "Switch conversations?",
        description:
          "Your current post draft will be discarded when you switch feeds.",
        confirmLabel: "Switch feed",
      }))
    )
      return;
    setScope(next);
  }
  return (
    <AppShell currentUser={user || undefined}>
      <div className="community-page">
        <FcPageHeader
          title="Arena Talk"
          subtitle="Discuss matches with FC ARENA members or in your league’s private feed."
          action={<Link href="/experience" className="community-button">My player journey</Link>}
        />
        {error ? <FcErrorState title="Arena Talk unavailable" message={error} onRetry={() => void load()} /> : null}
        {context ? (
          <>
            <div
              className="arena-tabs"
              role="group"
              aria-label="Conversation audience"
            >
              <button
                aria-pressed={scope === "PUBLIC"}
                onClick={() => void switchScope("PUBLIC")}
              >
                Football Talk <small>All FC ARENA members</small>
              </button>
              <button
                disabled={!context.leagues.length}
                aria-pressed={scope !== "PUBLIC"}
                onClick={() =>
                  void switchScope(context.leagues[0]?.id || "PUBLIC")
                }
              >
                My League{" "}
                <small>
                  {context.leagues.length
                    ? "Members only"
                    : "Join a league to unlock"}
                </small>
              </button>
            </div>
            {scope !== "PUBLIC" && (
              <label className="arena-league-select">
                Choose your league
                <select
                  value={scope}
                  onChange={(e) => void switchScope(e.target.value)}
                >
                  {context.leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="community-muted arena-audience-note">
              {context.policy.audienceNote}
            </p>
            <div className="arena-layout">
              <ArenaFeed
                key={scope}
                leagueId={scope === "PUBLIC" ? null : scope}
                leagueName={
                  scope === "PUBLIC"
                    ? "Football Talk"
                    : context.leagues.find((l) => l.id === scope)?.name ||
                      "My League"
                }
              />
              <aside className="community-panel arena-sidebar">
                <h2>Community guidelines</h2>
                <ul>
                  <li>Debate the game. Respect the player.</li>
                  <li>Add a source when sharing news.</li>
                  <li>Label rumours honestly.</li>
                  <li>Report abuse and block unwanted interactions.</li>
                </ul>
                <Link className="community-button" href="/safety">
                  Safety tools ↗
                </Link>
                {context.canModerate && (
                  <Link className="community-button" href="/admin/community">
                    Review community reports ↗
                  </Link>
                )}
              </aside>
            </div>
          </>
        ) : (
          !error && <FcLoadingScreen label="Loading Arena Talk…" embedded />
        )}
      </div>
    </AppShell>
  );
}
