"use client";

import { confirmAction } from "@/components/fc/confirmation-provider";
import { FcNotice } from "@/components/fc/fc-ui";
import { ShareCard } from "@/components/fc/share-card";
import Link from "next/link";

import { useRouter } from "next/navigation";

import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/app/app-shell";

import {
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
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

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [imageBusy, setImageBusy] = useState(false);

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

  async function uploadProfileImage(file: File) {
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
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "Unable to upload profile photo.",
      );
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
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  if (!user || !career) {
    return <FcLoadingScreen label="Loading Player Profile..." />;
  }

  const identity = career.profile.identity;

  const identityLocked = Boolean(identity?.isVerified || identity?.lockedAt);

  const playerName = identity?.inGameName || career.profile.fullName;

  const stats = career.lifetimeStatistics;

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
      <div className="space-y-6">
        <ShareCard title={user.player?.identity?.inGameName || user.fullName} lines={[`Player ID: ${career.profile.playerCode || "Pending"}`, `${career.lifetimeStatistics.matches} matches · ${career.lifetimeStatistics.wins} wins`, `${career.lifetimeStatistics.goalsFor} goals · ${career.lifetimeStatistics.winRate}% win rate`]} />
        <FcPanel className="overflow-hidden">
          <div className="fc-profile-banner h-20 sm:h-24" />

          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                <div className="shrink-0">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      event.target.value = "";

                      if (file) {
                        void uploadProfileImage(file);
                      }
                    }}
                  />

                  <button
                    type="button"
                    disabled={imageBusy}
                    onClick={() => imageInputRef.current?.click()}
                    className="group relative block h-24 w-24 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03] shadow-sm disabled:opacity-60"
                    aria-label="Choose profile photo"
                  >
                    {career.profile.profileImageUrl ? (
                      <img
                        src={career.profile.profileImageUrl}
                        alt={playerName + " profile"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="theme-text grid h-full w-full place-items-center text-2xl font-bold">
                        {playerName
                          .split(/\s+/)
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}

                    <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-center text-[10px] font-semibold text-white">
                      {imageBusy ? imageProgress + "%" : "Change photo"}
                    </span>
                  </button>
                </div>

                <div className="min-w-0">
                  <p className="theme-text-link text-xs font-semibold uppercase tracking-[0.16em]">
                    FC ARENA Player
                  </p>

                  <h1 className="theme-text mt-1 break-words text-2xl font-bold leading-tight tracking-[-0.03em] sm:text-3xl lg:text-4xl">
                    {career.profile.fullName}
                  </h1>

                  <p className="theme-secondary-text mt-2 break-words text-sm">
                    In-Game Name:{" "}
                    <span className="theme-text font-semibold">
                      {playerName}
                    </span>
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {career.profile.playerCode ? (
                      <span className="theme-soft-accent rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold">
                        {career.profile.playerCode}
                      </span>
                    ) : null}

                    <FcStatusBadge
                      label={
                        identity?.isVerified
                          ? "Verified Player"
                          : "Active Player"
                      }
                      tone={identity?.isVerified ? "emerald" : "cyan"}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={imageBusy}
                      onClick={() => imageInputRef.current?.click()}
                      className="theme-secondary-button min-h-10 rounded-[10px] border px-3.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {career.profile.profileImageUrl
                        ? "Change Photo"
                        : "Upload Photo"}
                    </button>

                    {career.profile.profileImageUrl ? (
                      <button
                        type="button"
                        disabled={imageBusy}
                        onClick={() => void removeProfileImage()}
                        className="theme-danger-button min-h-10 rounded-[10px] border px-3.5 text-xs font-semibold disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="shrink-0 lg:text-right">
                <p className="theme-muted text-xs">Profile photo</p>

                <p className="theme-secondary-text mt-1 max-w-xs text-xs leading-5">
                  Choose a PNG, JPG or WEBP image from your device. It will be
                  optimized automatically.
                </p>
              </div>
            </div>

            {imageMessage ? (
              <div className="mt-5"><FcNotice>
                {imageMessage}
              </FcNotice></div>
            ) : null}

            {imageError ? (
              <div className="mt-5"><FcNotice tone="error">
                {imageError}
              </FcNotice></div>
            ) : null}
          </div>
        </FcPanel>

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
                  name="email"
                  value={career.profile.email}
                  className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-normal opacity-70"
                  readOnly
                  aria-readonly="true"
                />
                <span className="theme-muted mt-1 block text-xs font-normal">Email is read-only.</span>
              </label>

              <label className="theme-text text-sm font-semibold">
                Phone
                <input
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
                  value={new Date(career.profile.joinedAt).toLocaleDateString()}
                  className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-normal opacity-70"
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
                  className="theme-primary-button min-h-10 rounded-[10px] px-4 text-xs font-semibold disabled:opacity-50"
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
      </div>
    </AppShell>
  );
}
