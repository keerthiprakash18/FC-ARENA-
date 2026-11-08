"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authenticatedRequest } from "@/lib/auth-client";
import { cosmeticPalette, cosmeticBadge } from '@/lib/daily-rewards';
import {
  errorMessage,
  type ApiData,
  type PlayerCardData,
  type PlayerExperience,
} from "@/lib/player-experience";
import { PlayerIdentityCard } from "./player-identity-card";
import {
  prepareCardDownload,
  startCardDownload,
  type CardDownload,
} from "@/lib/card-download";
import { CardDownloadReady } from "./card-download-ready";

export function PlayerJourney({
  player,
  full = false,
}: {
  player: PlayerCardData;
  full?: boolean;
}) {
  const [data, setData] = useState<PlayerExperience | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloadCard, setDownloadCard] = useState<CardDownload | null>(null);
  const readEpoch=useRef(0);
  const invalidateLoad=()=>{readEpoch.current++;};
  async function load() {
    const epoch=++readEpoch.current;
    setError("");
    try {
      const response=await authenticatedRequest<ApiData<PlayerExperience>>("/experience/me");
      if(epoch===readEpoch.current)setData(response.data);
    } catch (err) {
      if(epoch===readEpoch.current)setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
    const refresh=()=>{void load();};
    window.addEventListener('fc-arena:cosmetics-changed',refresh);
    return()=>{invalidateLoad();window.removeEventListener('fc-arena:cosmetics-changed',refresh);};
  }, []);
  async function frame(id: string) {
    if (busy) return;
    setBusy(true);
    const epoch=++readEpoch.current;
    setError("");
    try {
      const response=await authenticatedRequest<ApiData<PlayerExperience>>(
            "/experience/me/frame",
            { method: "PATCH", body: JSON.stringify({ frame: id }) },
          );
      if(epoch===readEpoch.current)setData(response.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!data || sharing) return;
    setSharing(true);
    setError("");
    setDownloadCard(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const c = canvas.getContext("2d");
      if (!c) throw new Error("Your browser could not create the player card.");
      const accent =
        data.frame === "SKY"
          ? "#7dd3fc"
          : data.frame === "GOLD"
            ? "#f6ce7a"
            : data.frame === "CHAMPION"
              ? "#d8b4fe"
              : "#a6e9d6";
      const bg = c.createLinearGradient(0, 0, 1080, 1350);
      const palette=cosmeticPalette(data.cosmetics?.background);
      bg.addColorStop(0, palette[0]);
      bg.addColorStop(1, palette[1]);
      c.fillStyle = bg;
      c.fillRect(0, 0, 1080, 1350);
      c.strokeStyle = accent;
      c.lineWidth = 4;
      c.strokeRect(35, 35, 1010, 1280);
      c.globalAlpha = 0.12;
      c.lineWidth = 3;
      c.strokeRect(80, 190, 920, 770);
      c.beginPath();
      c.arc(540, 575, 170, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
      c.textAlign = "left";
      c.fillStyle = accent;
      c.font = "bold 27px sans-serif";
      c.fillText("FC ARENA  /  PLAYER EDITION", 85, 110);
      c.textAlign = "center";
      let avatar: HTMLImageElement | null = null;
      if (player.avatar) {
        avatar = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const timer = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            img.src = "";
            reject(
              new Error(
                "Your profile photo took too long to load. Please try creating the card again.",
              ),
            );
          }, 10000);
          img.onload = () => {
            clearTimeout(timer);
            resolve(img);
          };
          img.onerror = () => {
            clearTimeout(timer);
            reject(
              new Error(
                "Your profile photo could not be loaded for this card. Please try again.",
              ),
            );
          };
          img.src = player.avatar!;
        });
      }
      c.save();
      c.beginPath();
      c.arc(540, 400, 175, 0, Math.PI * 2);
      c.clip();
      c.fillStyle = "#203b46";
      c.fillRect(365, 225, 350, 350);
      if (avatar) {
        const scale = Math.max(350 / avatar.width, 350 / avatar.height);
        c.drawImage(
          avatar,
          540 - (avatar.width * scale) / 2,
          400 - (avatar.height * scale) / 2,
          avatar.width * scale,
          avatar.height * scale,
        );
      } else {
        c.fillStyle = accent;
        c.font = "bold 100px sans-serif";
        c.fillText(player.name.slice(0, 2).toUpperCase(), 540, 435);
      }
      c.restore();
      c.fillStyle = accent;
      c.font = "bold 28px sans-serif";
      c.fillText(
        `LEVEL ${data.level}  ·  ${data.title.toUpperCase()}`,
        540,
        650,
      );
      c.fillStyle = "#fff";
      let size = 72;
      do {
        c.font = `bold ${size--}px sans-serif`;
      } while (c.measureText(player.name).width > 900 && size > 24);
      c.fillText(player.name, 540, 755, 900);
      c.font = "28px sans-serif";
      c.fillStyle = "#b7c9d8";
      c.fillText(
        `${player.code || "FC ARENA"}${player.verified ? "  ·  VERIFIED IDENTITY" : ""}`,
        540,
        810,
      );
      [
        ["MATCHES", player.matches],
        ["WINS", player.wins],
        ["GOALS", player.goals],
      ].forEach(([label, value], i) => {
        const x = 220 + i * 320;
        c.fillStyle = "#fff";
        c.font = "bold 65px sans-serif";
        c.fillText(String(value), x, 965);
        c.fillStyle = "#b7c9d8";
        c.font = "23px sans-serif";
        c.fillText(String(label), x, 1010);
      });
      c.fillStyle = accent;
      c.font = "bold 38px sans-serif";
      c.fillText(`${data.totalXp.toLocaleString()} XP`, 540, 1150);
      c.fillStyle = "#b7c9d8";
      c.font = "24px sans-serif";
      c.fillText("Verified participation. Your football journey.", 540, 1200);
      c.fillText("fcarena.in", 540, 1260);
      if(cosmeticBadge(data.cosmetics?.badge)){c.fillStyle=accent;c.font='bold 25px sans-serif';c.fillText(`✦ ${cosmeticBadge(data.cosmetics?.badge)}`,540,1110);}
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Unable to export this card.")),
          "image/png",
        ),
      );
      const card = await prepareCardDownload(
        blob,
        `FC-ARENA-${player.code || "player"}.png`,
      );
      setDownloadCard(card);
      startCardDownload(card);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSharing(false);
    }
  }
  return (
    <section className="journey" aria-label="Player journey">
      <div className="journey-heading">
        <div>
          <span className="community-eyebrow">YOUR NEXT CHAPTER</span>
          <h2>Built by every match.</h2>
        </div>
        {!full && (
          <Link className="community-button" href="/experience">
            View progress ↗
          </Link>
        )}
      </div>
      {error && (
        <div className="community-error" role="alert">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            Refresh progress
          </button>
        </div>
      )}
      <div className="journey-grid">
        <PlayerIdentityCard player={player} progress={data} />
        <div className="journey-content">
          {data ? (
            <>
              <div className="journey-level">
                <span className="community-eyebrow">
                  LEVEL {data.level} · {data.title}
                </span>
                <h3>
                  {data.xpToNextLevel.toLocaleString()} XP to your next level
                </h3>
                <progress
                  aria-label="Progress to next level"
                  max="100"
                  value={data.levelProgress}
                />
                <div className="community-between">
                  <span>{data.totalXp.toLocaleString()} total XP</span>
                  <span>
                    Level {data.level + 1} at{" "}
                    {data.nextLevelXp.toLocaleString()} XP
                  </span>
                </div>
              </div>
              <div className="community-between">
                <h3>This week’s missions</h3>
                <span>
                  {data.week.completedMissions}/{data.week.missions.length} done
                </span>
              </div>
              <div className="mission-list">
                {data.week.missions.map((m) => (
                  <div
                    className={`mission ${m.completed ? "is-complete" : ""}`}
                    key={m.id}
                  >
                    <span className="mission-check" aria-hidden="true">
                      {m.completed ? "✓" : "○"}
                    </span>
                    <div>
                      <strong>{m.title}</strong>
                      <p>{m.description}</p>
                      <progress
                        aria-label={`${m.title}: ${m.progress} of ${m.target}`}
                        value={m.progress}
                        max={m.target}
                      />
                      <small>
                        {m.progress}/{m.target} ·{" "}
                        {m.completed ? "Bonus awarded" : "In progress"}
                      </small>
                    </div>
                    <b>
                      +{m.xp}
                      <small>XP</small>
                    </b>
                  </div>
                ))}
              </div>
              <p className="community-muted">
                Resets Monday, 00:00 IST ·{" "}
                {new Date(data.week.endsAt).toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  day: "numeric",
                  month: "short",
                })}
                . Bonuses are applied automatically after results are verified.
              </p>
            </>
          ) : (
            !error && <p role="status">Loading missions and level…</p>
          )}
          <div className="community-actions">
            <button
              className="community-button primary"
              disabled={!data || sharing}
              onClick={() => void download()}
            >
              {sharing ? "Creating card…" : "Download player card ↓"}
            </button>
            <Link className="community-button" href="/arena-talk">
              Arena Talk ↗
            </Link>
          </div>
        </div>
      </div>
      {downloadCard && <CardDownloadReady card={downloadCard} />}
      {full && data && (
        <div className="journey-extras">
          <section className="community-panel">
            <span className="community-eyebrow">MAKE IT YOURS</span>
            <h3>Choose your card frame</h3>
            <p className="community-muted">
              Frames unlock as you play. Your selected frame also appears on
              exported cards.
            </p>
            <div className="frame-picker">
              {data.frames.map((f) => (
                <button
                  className={`frame-choice frame-${f.id}`}
                  key={f.id}
                  disabled={busy || !f.unlocked}
                  aria-pressed={data.frame === f.id}
                  onClick={() => void frame(f.id)}
                >
                  <span className="frame-swatch" />
                  <strong>{f.name}</strong>
                  <small>
                    {data.frame === f.id
                      ? "Selected ✓"
                      : f.unlocked
                        ? "Use frame"
                        : `Unlock at Level ${f.level}`}
                  </small>
                </button>
              ))}
            </div>
          </section>
          <section className="community-panel">
            <span className="community-eyebrow">EVERY POINT HAS A PURPOSE</span>
            <h3>How your XP adds up</h3>
            <dl className="xp-breakdown">
              <div>
                <dt>Verified matches · {data.policy.matchXp} XP each</dt>
                <dd>{data.breakdown.matchXp} XP</dd>
              </div>
              <div>
                <dt>
                  Completed tournaments · {data.policy.tournamentXp} XP each
                </dt>
                <dd>{data.breakdown.tournamentXp} XP</dd>
              </div>
              <div>
                <dt>Weekly mission bonuses</dt>
                <dd>{data.breakdown.missionXp} XP</dd>
              </div>
            </dl>
            <p className="community-muted">
              {data.policy.note} Posts, likes and repeat uploads do not earn XP.
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
