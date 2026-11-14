"use client";

import { confirmAction } from "@/components/fc/confirmation-provider";
import { FcNotice, FcPageHeader, FcStatusBadge } from "@/components/fc/fc-ui";
import { ProfilePhotoEditor } from "@/components/profile/profile-photo-editor";
import { PlayerJourney } from "@/components/experience/player-journey";
import Link from "next/link";

import { useRouter } from "next/navigation";

import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/app/app-shell";

import {
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
} from "@/components/fc/fc-ui";

import {
  authenticatedRequest,
  authenticatedUpload,
  type CurrentUser,
  getCurrentUser,
} from "@/lib/auth-client";

interface CareerData {
  profile: {
    fullName: string;
    email: string;
    phoneNumber: string | null;
    joinedAt: string;
    playerCode: string | null;
    profileImageUrl: string | null;

    identity: {
      inGameName: string;
      gameUid: string | null;
      isVerified: boolean;
      verifiedAt: string | null;
      lockedAt: string | null;
    } | null;

    primaryLeague: {
      league: {
        id: string;
        name: string;
        code: string;
      };
    } | null;

    secondaryLeague: {
      league: {
        id: string;
        name: string;
        code: string;
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
    form: string[];
    tournaments: number;
    achievements: number;
  };

  achievements: Array<{
    id: string;
    title: string;
    type: string;
    awardedAt: string;
  }>;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="border-b border-black/5 py-3 last:border-0">
      <p className="theme-muted text-[10px] font-semibold uppercase tracking-[0.15em]">
        {label}
      </p>

      <p className="theme-text mt-1 break-all text-sm font-medium">
        {value || "Not provided"}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [career, setCareer] = useState<CareerData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [journeyExpanded, setJourneyExpanded] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [imageBusy, setImageBusy] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [imageProgress, setImageProgress] = useState(0);

  const [imageMessage, setImageMessage] = useState("");

  const [imageError, setImageError] = useState("");

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phoneNumber: "",
    inGameName: "",
    gameUid: "",
  });

  const [profileBusy, setProfileBusy] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");

  const [profileError, setProfileError] = useState("");

  function applyProfileImage(profileImageUrl: string | null) {
    setCareer((current) =>
      current
        ? {
            ...current,
            profile: {
              ...current.profile,
              profileImageUrl,
            },
          }
        : current,
    );

    setUser((current) =>
      current
        ? {
            ...current,
            player: current.player
              ? {
                  ...current.player,
                  profileImageUrl,
                }
              : current.player,
          }
        : current,
    );

    window.dispatchEvent(
      new CustomEvent("fc-arena-profile-image-changed", {
        detail: {
          profileImageUrl,
        },
      }),
    );
  }

  async function uploadProfileImage(file: File): Promise<boolean> {
    setImageBusy(true);

    setImageProgress(0);

    setImageError("");

    setImageMessage("");

    const body = new FormData();

    body.append("image", file);

    try {
      const response = await authenticatedUpload<{
        success: true;
        data: {
          message: string;
          profileImageUrl: string;
        };
        error: null;
      }>("/players/me/profile-image", body, (progress) =>
        setImageProgress(progress),
      );

      applyProfileImage(response.data.profileImageUrl);

      setImageMessage(response.data.message);

      setImageProgress(100);
      return true;
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "Unable to upload profile photo.",
      );
      return false;
    } finally {
      setImageBusy(false);
    }
  }

  async function removeProfileImage() {
    if (imageBusy || !career?.profile.profileImageUrl) {
      return;
    }

    if (!(await confirmAction({ title: 'Remove profile photo?', description: 'Remove your current profile photo? You can upload a new photo later.', confirmLabel: 'Remove photo', destructive: true }))) {
      return;
    }

    setImageBusy(true);

    setImageError("");

    setImageMessage("");

    try {
      const response = await authenticatedRequest<{
        success: true;
        data: {
          message: string;
          profileImageUrl: null;
        };
        error: null;
      }>("/players/me/profile-image", {
        method: "DELETE",
      });

      applyProfileImage(null);

      setImageMessage(response.data.message);

      setImageProgress(0);
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "Unable to remove profile photo.",
      );
    } finally {
      setImageBusy(false);
    }
  }

  useEffect(() => {
    void (async () => {
      setLoadError("");
      try {
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

        setProfileForm({
          fullName: response.data.profile.fullName,
          phoneNumber: response.data.profile.phoneNumber || "",
          inGameName: response.data.profile.identity?.inGameName || "",
          gameUid: response.data.profile.identity?.gameUid || "",
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Unable to load your profile.");
      }
    })();
  }, [router, loadAttempt]);

  if (!user || !career) {
    if (loadError) return <AppShell><div className="community-error" role="alert">{loadError}<button type="button" onClick={() => setLoadAttempt(value => value + 1)}>Try again</button><Link href="/login">Sign in</Link></div></AppShell>;
    return <AppShell currentUser={user ?? undefined}><FcLoadingScreen label="Loading Player Profile..." embedded /></AppShell>;
  }

  const identity = career.profile.identity;

  const identityLocked = Boolean(identity?.isVerified || identity?.lockedAt);

  const playerName = identity?.inGameName || career.profile.fullName;

  const stats = career.lifetimeStatistics;
  const joinedAt = Date.parse(career.profile.joinedAt);

  async function saveProfile() {
    const fullName = profileForm.fullName.trim();
    const phoneNumber = profileForm.phoneNumber.trim();
    const inGameName = profileForm.inGameName.trim();
    const gameUid = profileForm.gameUid.trim();

    if (fullName.length < 2 || fullName.length > 120) {
      setProfileError("Full name must be between 2 and 120 characters.");
      return;
    }

    if (phoneNumber.length > 30) {
      setProfileError("Phone number must be at most 30 characters.");
      return;
    }

    if (!identityLocked && (inGameName.length < 2 || inGameName.length > 80)) {
      setProfileError("In-game name must be between 2 and 80 characters.");
      return;
    }

    if (!identityLocked && gameUid.length > 100) {
      setProfileError("Game UID must be at most 100 characters.");
      return;
    }

    setProfileBusy(true);
    setProfileError("");
    setProfileMessage("");

    try {
      const response = await authenticatedRequest<{
        success: true;
        data: {
          message: string;
          profile: CareerData["profile"];
        };
        error: null;
      }>("/players/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName,
          phoneNumber: phoneNumber || null,
          ...(identityLocked
            ? {}
            : {
                inGameName,
                gameUid: gameUid || null,
              }),
        }),
      });

      setCareer((current) =>
        current
          ? { ...current, profile: { ...current.profile, ...response.data.profile } }
          : current,
      );
      setUser((current) =>
        current
          ? {
              ...current,
              fullName: response.data.profile.fullName,
              phoneNumber: response.data.profile.phoneNumber,
              player: current.player
                ? {
                    ...current.player,
                    identity: response.data.profile.identity
                      ? {
                          ...current.player.identity,
                          ...response.data.profile.identity,
                        }
                      : current.player.identity,
                  }
                : current.player,
            }
          : current,
      );
      setProfileForm({
        fullName: response.data.profile.fullName,
        phoneNumber: response.data.profile.phoneNumber || "",
        inGameName: response.data.profile.identity?.inGameName || "",
        gameUid: response.data.profile.identity?.gameUid || "",
      });
      setProfileMessage(response.data.message);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Unable to update your profile.",
      );
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <AppShell playerName={playerName}>
      <div className="fc-profile-page space-y-6">
        <FcPageHeader
          icon="profile"
          eyebrow="Player"
          title="Your player profile"
          subtitle="Manage your identity, profile photo and player card."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <FcStatusBadge label={identity?.isVerified ? "Verified Player" : "Verification Pending"} tone={identity?.isVerified ? "emerald" : "amber"} />
              <Link href="/career" className="theme-primary-button inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">
                Career statistics ↗
              </Link>
            </div>
          }
        />
        <section className="profile-photo-settings fc-player-identity theme-panel" aria-label="Profile photo">
          <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden onChange={event => { const selected = event.target.files?.[0]; event.target.value = ""; if (selected) { setImageError(""); setImageMessage(""); setPhotoFile(selected); } }} />
          <button type="button" className="profile-photo-current" disabled={imageBusy} onClick={() => imageInputRef.current?.click()}>
            {career.profile.profileImageUrl ? <img src={career.profile.profileImageUrl} alt="" /> : <span>{playerName.slice(0, 2).toUpperCase()}</span>}
            <small>Edit photo</small>
            <span className="sr-only">Choose profile photo</span>
          </button>
          <div><span className="community-eyebrow">YOUR PROFILE PHOTO</span><h2>{playerName}</h2><p className="community-muted">Preview, move, zoom and rotate your photo before saving.</p><div className="community-actions"><button type="button" className="community-button primary" disabled={imageBusy} onClick={() => imageInputRef.current?.click()}>{career.profile.profileImageUrl ? "Change photo" : "Add profile photo"}</button>{career.profile.profileImageUrl && <button type="button" className="community-button" disabled={imageBusy} onClick={() => void removeProfileImage()}>Remove photo</button>}</div></div>
          {imageMessage && <p className="community-success" role="status">{imageMessage}</p>}
          {imageError && !photoFile && <p className="community-error" role="alert">{imageError}</p>}
        </section>
        {photoFile && <ProfilePhotoEditor file={photoFile} busy={imageBusy} progress={imageProgress} error={imageError} onSave={uploadProfileImage} onCancel={() => { if (!imageBusy) setPhotoFile(null); }} onChoose={selected => { setImageError(""); setPhotoFile(selected); }} />}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FcStatCard
            label="Matches"
            value={stats.matches}
            detail={stats.wins + " wins · " + stats.draws + " draws"}
          />

          <FcStatCard
            label="Win Rate"
            value={stats.winRate + "%"}
            detail={stats.losses + " losses"}
            tone="emerald"
          />

          <FcStatCard
            label="Goals"
            value={stats.goalsFor}
            detail={
              "GA " +
              stats.goalsAgainst +
              " · GD " +
              (stats.goalDifference > 0 ? "+" : "") +
              stats.goalDifference
            }
            tone="amber"
          />

          <FcStatCard
            label="Achievements"
            value={stats.achievements}
            detail={stats.tournaments + " tournaments"}
            tone="slate"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <FcPanel className="p-5 sm:p-6">
            <h2 className="theme-text text-lg font-semibold">
              Player Identity
            </h2>

            <div className="mt-3">
              <Detail label="FC ARENA ID" value={career.profile.playerCode} />

              <Detail label="In-Game Name" value={identity?.inGameName} />

              <Detail label="Game UID" value={identity?.gameUid} />

              <Detail
                label="Verification"
                value={
                  identity?.isVerified
                    ? "Verified & locked"
                    : "Not yet verified"
                }
              />
            </div>
          </FcPanel>

          <FcPanel className="p-5 sm:p-6">
            <h2 className="theme-text text-lg font-semibold">Career Context</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                href={
                  career.profile.primaryLeague
                    ? "/leagues/" + career.profile.primaryLeague.league.id
                    : "/leagues"
                }
                className="theme-action-row rounded-2xl border p-4"
              >
                <p className="theme-muted text-xs">Primary League</p>

                <p className="theme-text mt-1 font-semibold">
                  {career.profile.primaryLeague?.league.name || "Not joined"}
                </p>
              </Link>

              <Link
                href={
                  career.profile.secondaryLeague
                    ? "/leagues/" + career.profile.secondaryLeague.league.id
                    : "/leagues"
                }
                className="theme-action-row rounded-2xl border p-4"
              >
                <p className="theme-muted text-xs">Secondary League</p>

                <p className="theme-text mt-1 font-semibold">
                  {career.profile.secondaryLeague?.league.name || "Not joined"}
                </p>
              </Link>
            </div>

            <div className="mt-5">
              <p className="theme-muted text-xs font-medium">Recent Form</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {stats.form.length > 0 ? (
                  stats.form.map((result, index) => (
                    <span
                      key={result + index}
                      className={
                        "grid h-9 w-9 place-items-center rounded-xl border text-sm font-bold " +
                        (result === "W"
                          ? "theme-tone-success"
                          : result === "D"
                            ? "theme-tone-premium"
                            : "theme-tone-danger")
                      }
                    >
                      {result}
                    </span>
                  ))
                ) : (
                  <span className="theme-secondary-text text-sm">
                    No completed matches yet.
                  </span>
                )}
              </div>
            </div>
          </FcPanel>
        </section>

        <FcPanel className="p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="theme-muted text-xs">Account</p>

              <h2 className="theme-text mt-1 text-lg font-semibold">
                Contact & membership
              </h2>
            </div>

            <Link
              href="/settings"
              className="theme-text-link text-sm font-semibold"
            >
              Settings →
            </Link>
          </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="theme-text text-sm font-semibold">
                Full Name
                <input
                  type="text"
                  autoComplete="name"
                  name="fullName"
                  value={profileForm.fullName}
                  onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
                  maxLength={120}
                  disabled={profileBusy}
                />
              </label>

              <label className="theme-text text-sm font-semibold">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  name="email"
                  value={career.profile.email}
                  className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
                  readOnly
                  aria-readonly="true"
                />
                <span className="theme-muted mt-1 block text-xs font-normal">Email is read-only.</span>
              </label>

              <label className="theme-text text-sm font-semibold">
                Phone
                <input
                  type="tel"
                  autoComplete="tel"
                  name="phoneNumber"
                  value={profileForm.phoneNumber}
                  onChange={(event) => setProfileForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                  className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
                  maxLength={30}
                  disabled={profileBusy}
                />
              </label>

              <label className="theme-text text-sm font-semibold">
                Member Since
                <input
                  value={Number.isFinite(joinedAt) ? new Date(joinedAt).toLocaleDateString() : "—"}
                  className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
                  readOnly
                />
              </label>
            </div>

            <div className="mt-5 border-t border-black/5 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="theme-text text-sm font-semibold">Player identity</p>
                  <p className="theme-muted mt-1 text-xs">
                    {identityLocked
                      ? "Verified identity is locked and cannot be edited."
                      : "Use the identity shown in your FC ARENA competitions."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void saveProfile()}
                  disabled={profileBusy}
                  className="theme-primary-button min-h-11 rounded-[10px] px-4 text-xs font-semibold disabled:opacity-50"
                >
                  {profileBusy ? "Saving…" : "Save profile"}
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="theme-text text-sm font-semibold">
                  In-Game Name
                  <input
                    name="inGameName"
                    value={profileForm.inGameName}
                    onChange={(event) => setProfileForm((current) => ({ ...current, inGameName: event.target.value }))}
                    className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-normal disabled:opacity-60"
                    maxLength={80}
                    disabled={profileBusy || identityLocked}
                  />
                </label>

                <label className="theme-text text-sm font-semibold">
                  Game UID
                  <input
                    name="gameUid"
                    value={profileForm.gameUid}
                    onChange={(event) => setProfileForm((current) => ({ ...current, gameUid: event.target.value }))}
                    className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-normal disabled:opacity-60"
                    maxLength={100}
                    disabled={profileBusy || identityLocked}
                  />
                </label>
              </div>

              {profileMessage ? <div className="mt-4"><FcNotice>{profileMessage}</FcNotice></div> : null}
              {profileError ? <div className="mt-4"><FcNotice tone="error">{profileError}</FcNotice></div> : null}
            </div>
          </FcPanel>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Career Stats", "/career"],
            ["Match History", "/career/matches"],
            ["Achievements", "/career/achievements"],
            ["Leaderboards", "/leaderboards"],
          ].map(([title, href]) => (
            <Link
              key={href}
              href={href}
              className="theme-action-row rounded-2xl border p-4"
            >
              <p className="theme-text font-semibold">{title}</p>

              <p className="theme-muted mt-2 text-xs">Open →</p>
            </Link>
          ))}
        </section>

        <details onToggle={event => setJourneyExpanded(event.currentTarget.open)} className="group rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)]">
          <summary className="theme-text flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-focus)] [&::-webkit-details-marker]:hidden">
            <span>Player Journey, missions &amp; XP</span>
            <span className="theme-secondary-text shrink-0 text-sm group-open:hidden">Expand ↓</span>
            <span className="theme-secondary-text hidden shrink-0 text-sm group-open:inline">Collapse ↑</span>
          </summary>
          <div className="border-t border-[var(--theme-border)] px-3 py-4 sm:px-5">
            {journeyExpanded ? <PlayerJourney player={{ name: playerName, code: career.profile.playerCode, avatar: career.profile.profileImageUrl, verified: identity?.isVerified || false, matches: career.lifetimeStatistics.matches, wins: career.lifetimeStatistics.wins, goals: career.lifetimeStatistics.goalsFor, winRate: career.lifetimeStatistics.winRate }} /> : null}
          </div>
        </details>
      </div>
    </AppShell>
  );
}
