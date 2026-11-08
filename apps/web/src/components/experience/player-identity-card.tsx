"use client";
import { useEffect, useState } from "react";
import { authenticatedRequest } from "@/lib/auth-client";
import { cosmeticBadge } from '@/lib/daily-rewards';
import type {
  ApiData,
  PlayerCardData,
  PlayerExperience,
} from "@/lib/player-experience";
type CardProgress = Pick<
  PlayerExperience,
  "frame" | "level" | "title" | "totalXp"
> & { streak?: number; cosmetics?:PlayerExperience['cosmetics'] };
export function PlayerIdentityCard({
  player,
  progress,
}: {
  player: PlayerCardData;
  progress: CardProgress | null;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => {
    setAvatarFailed(false);
  }, [player.avatar]);
  return (
    <div className={`player-edition frame-${progress?.frame || "CLASSIC"}`} data-background={progress?.cosmetics?.background||'CLASSIC'}>
      <div className="edition-top">
        <span>FC ARENA</span>
        <span>PLAYER EDITION</span>
      </div>
      <svg className="edition-pitch" viewBox="0 0 300 350" aria-hidden="true">
        <rect x="15" y="15" width="270" height="320" rx="4" />
        <path d="M15 175h270M85 15v55h130V15M85 335v-55h130v55" />
        <circle cx="150" cy="175" r="50" />
      </svg>
      <div className="edition-portrait">
        {player.avatar && !avatarFailed ? (
          <img
            src={player.avatar}
            alt=""
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <span>{player.name.slice(0, 2).toUpperCase()}</span>
        )}
        <b className="edition-level">
          {progress ? progress.level : "—"}
          <small>LEVEL</small>
        </b>
      </div>
      <p className="edition-title">{progress?.title || "FC ARENA Player"}</p>
      {cosmeticBadge(progress?.cosmetics?.badge)&&<span className="edition-cosmetic">✦ {cosmeticBadge(progress?.cosmetics?.badge)}</span>}
      <h3>{player.name}</h3>
      <p className="edition-code">
        {player.code || "FC ARENA Player"}
        {player.verified && <span> · Verified identity ✓</span>}
      </p>
      <div className="edition-stats">
        {[
          ["Matches", player.matches],
          ["Wins", player.wins],
          ["Goals", player.goals],
        ].map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="edition-footer">
        <strong>
          {progress
            ? `${progress.totalXp.toLocaleString()} XP`
            : "Verified participation"}
        </strong>
        <span>
          {progress?.streak !== undefined
            ? `${progress.streak} week activity streak`
            : "Your football journey"}
        </span>
      </div>
    </div>
  );
}
export function PublicPlayerCard({
  userId,
  player,
}: {
  userId: string;
  player: PlayerCardData;
}) {
  const [progress, setProgress] = useState<{
    userId: string;
    value: CardProgress;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void authenticatedRequest<ApiData<CardProgress>>(
      `/experience/players/${userId}`,
    )
      .then((r) => {
        if (active) setProgress({ userId, value: r.data });
      })
      .catch(() => {
        if (active) setProgress(null);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  return (
    <div className="public-player-edition">
      <PlayerIdentityCard
        player={player}
        progress={progress?.userId === userId ? progress.value : null}
      />
    </div>
  );
}
