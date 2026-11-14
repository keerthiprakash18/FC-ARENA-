"use client";

import { confirmAction, confirmNamedDeletion } from "@/components/fc/confirmation-provider";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRecoverableLoad } from '@/lib/use-recoverable-load';

import { AppShell } from "@/components/app/app-shell";

import {
  FcCrest,
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcNotice,
  FcPageHeader,
  FcPanel,
  FcSectionHeading,
  FcStatusBadge,
} from "@/components/fc/fc-ui";

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from "@/lib/auth-client";

interface MyLeague {
  membershipType: "PRIMARY" | "SECONDARY";

  adminRole: "OWNER" | "ADMIN" | null;

  league: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
    description: string | null;
    region: string | null;
    members: number;
    maxMembers: number;
    pendingApplications: number;
  };
}

interface LeaguePreview {
  id: string;
  name: string;
  code: string | null;
  logoUrl?: string | null;
  description: string | null;
  region: string | null;
  members: number;
  maxMembers: number;
  alreadyMember: boolean;
  applicationStatus: string | null;
}

export default function LeaguesPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite") || "";
    if (/^[a-f0-9]{48}$/.test(token)) setInviteToken(token);
    try {
      const code = new URLSearchParams(window.location.search).get("code") || sessionStorage.getItem("fc-league-invite");
      if (code && /^[a-zA-Z0-9-]{1,40}$/.test(code)) {
        setInviteCode(code);
        sessionStorage.setItem("fc-league-invite", code);
      }
    } catch {}
  }, []);

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [leagues, setLeagues] = useState<MyLeague[]>([]);

  const [preview, setPreview] = useState<LeaguePreview | null>(null);
  const [previewInvite, setPreviewInvite] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  async function loadLeagues() {
    const response = await authenticatedRequest<{
      data: {
        leagues: MyLeague[];
      };
    }>("/leagues/my");

    setLeagues(response.data.leagues);
  }

  const initialLoad = useRecoverableLoad(async signal => {
    const [current, response] = await Promise.all([
      getCurrentUser({ signal }),
      authenticatedRequest<{ data: { leagues: MyLeague[] } }>('/leagues/my', { signal }),
    ]);
    if (signal.aborted) return;
    setUser(current); setLeagues(response.data.leagues);
  }, '', { preserveLeagueInvite: true });

  useEffect(() => {
    if (!user || !inviteToken) return;
    const controller = new AbortController();
    void authenticatedRequest<{ data: { league: LeaguePreview } }>(
      `/leagues/invites/${encodeURIComponent(inviteToken)}`, { signal: controller.signal },
    ).then(({ data }) => {
      if (controller.signal.aborted) return;
      setPreview(data.league);
      setPreviewInvite(inviteToken);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to read this invite.");
    });
    return () => controller.abort();
  }, [inviteToken, user]);

  async function createLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);

    setError("");

    setMessage("");

    const form = event.currentTarget;

    const data = new FormData(form);

    try {
      const response = await authenticatedRequest<any>("/leagues", {
        method: "POST",

        body: JSON.stringify({
          name: String(data.get("name") ?? ""),

          region: String(data.get("region") ?? "") || undefined,

          description: String(data.get("description") ?? "") || undefined,

          rules: String(data.get("rules") ?? "") || undefined,
        }),
      });

      setMessage(`${response.data.message} Code: ${response.data.league.code}`);

      form.reset();

      setShowCreate(false);

      await loadLeagues();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create League.");
    } finally {
      setBusy(false);
    }
  }

  async function findLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    setMessage("");

    setPreview(null);
    setPreviewInvite("");
    setInviteToken("");

    const form = new FormData(event.currentTarget);

    const code = String(form.get("code") ?? "")
      .trim()
      .toUpperCase();

    try {
      const response = await authenticatedRequest<any>(
        `/leagues/code/${encodeURIComponent(code)}`,
      );

      setPreview(response.data.league);
    } catch (err) {
      setError(err instanceof Error ? err.message : "League not found.");
    }
  }

  async function requestJoin() {
    if (!preview || leagues.length >= 2) {
      return;
    }

    setBusy(true);

    setError("");

    try {
      const response = await authenticatedRequest<any>("/leagues/join", {
        method: "POST",

        body: JSON.stringify(previewInvite ? { invite: previewInvite } : { code: preview.code }),
      });

      setMessage(response.data.message);

      setPreview({
        ...preview,
        applicationStatus: "PENDING",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to request membership.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteLeague(item: MyLeague) {
    if (item.adminRole !== "OWNER") {
      return;
    }

    const confirmation = await confirmNamedDeletion('League', item.league.name);

    if (confirmation === null) {
      return;
    }

    if (confirmation.trim() !== item.league.name.trim()) {
      setError("League name confirmation does not match.");

      return;
    }

    setBusy(true);

    setError("");

    setMessage("");

    try {
      const response = await authenticatedRequest<any>(
        `/leagues/${item.league.id}`,
        {
          method: "DELETE",

          body: JSON.stringify({
            confirmName: confirmation,
          }),
        },
      );

      setMessage(response.data.message);

      await loadLeagues();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete League.");
    } finally {
      setBusy(false);
    }
  }

  async function leaveLeague(item: MyLeague) {
    if (item.adminRole === "OWNER") {
      return;
    }

    if (!(await confirmAction({ title: 'Leave league?', description: `Leave “${item.league.name}”? Your league membership will be removed. You will need to request membership again to rejoin.`, confirmLabel: 'Leave league', destructive: true }))) {
      return;
    }

    setBusy(true);

    setError("");

    setMessage("");

    try {
      const response = await authenticatedRequest<any>(
        `/leagues/${item.league.id}/leave`,
        {
          method: "DELETE",
        },
      );

      setMessage(response.data.message);

      await loadLeagues();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to leave League.");
    } finally {
      setBusy(false);
    }
  }

  if (initialLoad.error) return <AppShell><FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} /></AppShell>;
  if (!user) {
    return <AppShell><FcLoadingScreen label="Loading Leagues..." embedded /></AppShell>;
  }

  const atLimit = leagues.length >= 2;

  return (
    <AppShell playerName={user.player?.identity?.inGameName}>
      <div className="space-y-6">
        <FcPageHeader
          title="Leagues"
          icon="league"
          subtitle="Manage your League memberships and join or create a competition."
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/leagues/explore" className="theme-secondary-button inline-flex min-h-11 items-center border px-4 text-sm">
                Explore Leagues
              </Link>
              <button
                type="button"
                disabled={atLimit}
                onClick={() => setShowCreate((value) => !value)}
                className="theme-primary-button min-h-11 border px-4 text-sm"
              >
                + Add League
              </button>
            </div>
          }
        />

        <FcNotice>{message}</FcNotice>
        <FcNotice tone="error">{error}</FcNotice>

        <section>
          <FcSectionHeading
            eyebrow="Memberships"
            title="My Leagues"
            action={
              <span className="text-xs font-black text-slate-600">
                {leagues.length}
                /2
              </span>
            }
          />

          {leagues.length === 0 ? (
            <div className="mt-4">
              <FcEmptyState
                title="No League memberships"
                description="Join a League with a unique code or create your own football community."
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {leagues.map((item) => (
                <article
                  key={item.league.id}
                  className="fc-arena-card"
                >
                  <Link
                    href={`/leagues/${item.league.id}`}
                    className="group block"
                  >
                    <div className="flex items-start gap-4">
                      <FcCrest
                        name={item.league.name}
                        imageUrl={item.league.logoUrl}
                        size="lg"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          <FcStatusBadge
                            label={item.membershipType}
                            tone={
                              item.membershipType === "PRIMARY"
                                ? "cyan"
                                : "slate"
                            }
                          />

                          {item.adminRole ? (
                            <FcStatusBadge
                              label={item.adminRole}
                              tone="amber"
                            />
                          ) : null}
                        </div>

                        <h2 className="mt-3 truncate text-lg font-semibold">
                          {item.league.name}
                        </h2>

                        <p className="theme-secondary-text mt-1 text-xs">
                          {item.league.region || "Region not specified"}
                          {" · "}
                          {item.league.members}/{item.league.maxMembers} members
                        </p>
                      </div>

                      <span className="theme-secondary-text text-xl">
                        ›
                      </span>
                    </div>

                    <div className="mt-4 border-t border-[var(--theme-border)] pt-3">
                      <p className="theme-secondary-text line-clamp-2 text-sm leading-6">
                        {item.league.description ||
                          "Open the League for overview, standings, fixtures, members, teams and settings."}
                      </p>
                    </div>
                  </Link>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--theme-border)] pt-3">
                    <Link
                      href={`/leagues/${item.league.id}`}
                      className="theme-primary-button inline-flex min-h-11 items-center justify-center border px-4 text-sm"
                    >
                      Open League
                    </Link>

                    <Link
                      href={`/leagues/${item.league.id}/settings`}
                      className="theme-secondary-button inline-flex min-h-11 items-center justify-center border px-4 text-sm"
                    >
                      Manage
                    </Link>

                    <div className="ml-auto">
                      {item.adminRole === "OWNER" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void deleteLeague(item)}
                          className="theme-danger-button min-h-11 border px-4 text-sm"
                        >
                          Delete League
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void leaveLeague(item)}
                          className="theme-danger-button min-h-11 border px-4 text-sm"
                        >
                          Leave League
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <FcPanel className="p-5 sm:p-6">
            <FcSectionHeading eyebrow="Join" title="League Code" />

            {atLimit ? (
              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                <p className="font-semibold text-[var(--theme-warning)]">
                  Two-League limit reached
                </p>

                <p className="mt-2 text-sm leading-6 theme-secondary-text">
                  Leave one current League before joining another.
                </p>
              </div>
            ) : (
              <form onSubmit={findLeague} className="mt-5 flex gap-2">
                <input
                  name="code"
                  value={inviteCode}
                  onChange={event => setInviteCode(event.target.value)}
                  aria-label="League invite code"
                  required
                  placeholder="LEAGUE CODE"
                  className="theme-field min-w-0 flex-1 border px-4 py-3 font-mono uppercase"
                />

                <button className="theme-primary-button min-h-11 border px-4 text-sm">
                  Find
                </button>
              </form>
            )}

            {preview ? (
              <div className="fc-arena-card mt-5">
                <div className="flex items-center gap-4">
                  <FcCrest name={preview.name} imageUrl={preview.logoUrl} />

                  <div className="min-w-0">
                    {preview.code ? <p className="font-mono text-[10px] font-black theme-secondary-text">
                      {preview.code}
                    </p> : null}

                    <h3 className="mt-1 truncate text-lg font-black">
                      {preview.name}
                    </h3>

                    <p className="mt-1 text-xs theme-secondary-text">
                      {preview.members}/{preview.maxMembers} members
                    </p>
                  </div>
                </div>

                {preview.alreadyMember ? (
                  <Link
                    href={`/leagues/${preview.id}`}
                    className="theme-primary-button mt-4 inline-flex min-h-11 items-center border px-4 text-sm"
                  >
                    Open League
                  </Link>
                ) : preview.applicationStatus === "PENDING" ? (
                  <div className="mt-4">
                    <FcStatusBadge label="Join Request Pending" tone="amber" />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy || atLimit}
                    onClick={() => void requestJoin()}
                    className="theme-primary-button mt-4 min-h-11 border px-4 text-sm"
                  >
                    Request to Join
                  </button>
                )}
              </div>
            ) : null}
          </FcPanel>

          <FcPanel className="p-5 sm:p-6">
            <FcSectionHeading eyebrow="Create" title="New League" />

            {!showCreate ? (
              <div className="mt-5">
                <p className="text-sm leading-6 theme-secondary-text">
                  Bring your players together. Create a league, share its invite
                  code and start your first tournament.
                </p>

                <button
                  type="button"
                  disabled={atLimit}
                  onClick={() => setShowCreate(true)}
                  className="theme-secondary-button mt-5 min-h-11 border px-4 text-sm"
                >
                  Create League
                </button>
              </div>
            ) : (
              <form onSubmit={createLeague} className="mt-5 grid gap-4">
                <label className="fc-field-label">
                  League name
                  <input
                    name="name"
                    required
                    placeholder="League name"
                    className="theme-field border px-4 py-3"
                  />
                </label>

                <label className="fc-field-label">
                  Region (optional)
                  <input
                    name="region"
                    placeholder="Region"
                    className="theme-field border px-4 py-3"
                  />
                </label>

                <label className="fc-field-label">
                  Description (optional)
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Description"
                    className="theme-field border px-4 py-3"
                  />
                </label>

                <label className="fc-field-label">
                  League rules (optional)
                  <textarea
                    name="rules"
                    rows={3}
                    placeholder="Rules"
                    className="theme-field border px-4 py-3"
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="theme-secondary-button min-h-11 border px-4 text-sm"
                  >
                    Cancel
                  </button>

                  <button
                    disabled={busy}
                    className="theme-primary-button min-h-11 border px-4 text-sm"
                  >
                    {busy ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            )}
          </FcPanel>
        </section>
      </div>
    </AppShell>
  );
}
