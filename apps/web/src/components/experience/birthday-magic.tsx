"use client";

import { useEffect, useRef, useState } from "react";
import type { CurrentUser } from "@/lib/auth-client";
import { birthdayDateForToday, birthdaySeenKey } from "@/lib/birthday-magic";
import styles from "./birthday-magic.module.css";

type Scene = "welcome" | "film" | "cake" | "letter" | "gift";

interface Props {
  user: CurrentUser;
  playerName: string;
  leagueName?: string | null;
}

/**
 * An intentionally isolated celebration: no extra API calls, no DB writes,
 * no fake coins or achievement grants. Production media is an explicit gate.
 * Voice comes from licensed studio audio only; NEVER browser speech synthesis.
 */
export function BirthdayMagic({ user, playerName, leagueName }: Props) {
  const enabled = process.env.NEXT_PUBLIC_BIRTHDAY_MAGIC_ENABLED === "true";
  const [date, setDate] = useState(() => birthdayDateForToday(user.dateOfBirth));
  const [open, setOpen] = useState(false);
  const [scene, setScene] = useState<Scene>("welcome");
  const [candlesOut, setCandlesOut] = useState(false);
  const [cakeCut, setCakeCut] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [cakePhotoAvailable, setCakePhotoAvailable] = useState(true);
  const [welcomePhotoAvailable, setWelcomePhotoAvailable] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const musicRef = useRef<HTMLAudioElement>(null);
  const voiceRef = useRef<HTMLAudioElement>(null);
  const filmRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Re-check after midnight, returning to a foreground tab, or changing accounts.
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setDate(birthdayDateForToday(user.dateOfBirth));
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, user.dateOfBirth]);

  useEffect(() => {
    if (!enabled || !date) {
      setOpen(false);
      return;
    }
    try {
      if (window.localStorage.getItem(birthdaySeenKey(user.id, date)) !== "1") setOpen(true);
    } catch {
      // Blocked storage must not prevent the birthday wish.
      setOpen(true);
    }
  }, [enabled, user.id, date]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
      if (event.key === "Tab") {
        // The visible close button is always accessible before anything else.
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>('[data-birthday-modal] button:not([disabled])')
        );
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      stopAudio();
    };
    // Audio refs are stable; handlers intentionally bound for this open state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function markSeen() {
    if (!date) return;
    try { window.localStorage.setItem(birthdaySeenKey(user.id, date), "1"); } catch { /* optional */ }
  }

  function stopAudio() {
    for (const ref of [musicRef, voiceRef]) { ref.current?.pause(); if (ref.current) ref.current.currentTime = 0; }
    filmRef.current?.pause();
  }

  function dismiss() {
    markSeen();
    stopAudio();
    setOpen(false);
  }

  function replay() {
    stopAudio();
    setScene("welcome");
    setCandlesOut(false);
    setCakeCut(false);
    setHasStarted(false);
    setOpen(true);
  }

  function playMusic() {
    if (!musicMuted && musicRef.current) {
      musicRef.current.volume = 0.3;
      void musicRef.current.play().catch(() => undefined);
    }
  }

  function playVoice(source: "opening" | "cake") {
    const audio = voiceRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = source === "opening"
      ? "/birthday-magic/voice-opening.mp3"
      : "/birthday-magic/voice-cake.mp3";
    audio.load();
    if (musicRef.current) musicRef.current.volume = 0.12;
    audio.onended = () => { if (musicRef.current) musicRef.current.volume = 0.3; };
    audio.onerror = () => { if (musicRef.current) musicRef.current.volume = 0.3; };
    // Studio recordings are optional. There is NO fallback to robotic TTS.
    void audio.play().catch(() => undefined);
  }

  function start() {
    setHasStarted(true);
    playMusic();
    if (videoAvailable) {
      setScene("film");
      window.setTimeout(() => {
        const video = filmRef.current;
        if (video) void video.play().catch(() => setScene("cake"));
      }, 50);
    } else {
      setScene("cake");
    }
    playVoice("opening");
  }

  function cutCake() {
    if (!candlesOut) return;
    if (cakeCut) setScene("letter");
    else { setCakeCut(true); playVoice("cake"); }
  }

  if (!enabled || !date) return null;
  const name = (playerName?.trim() || user.fullName.trim() || "Champion").slice(0, 80);
  const portrait = user.player?.profileImageUrl || null;

  return (
    <>
      <section className={styles.dayBanner} aria-label="Your birthday celebration">
        <div className={styles.daySparkles} aria-hidden="true">✦ &nbsp; ✳ &nbsp; ✦</div>
        <div className={styles.bannerText}>
          <span className={styles.eyebrow}>A LITTLE BIRTHDAY MAGIC · FC ARENA</span>
          <strong>Happy birthday, {name}!</strong>
          <p>Today is yours. A little surprise from your ARENA family.</p>
        </div>
        <button type="button" onClick={replay} className={styles.bannerButton}>Relive your moment <span aria-hidden="true">↗</span></button>
      </section>

      {open && (
        <div className={styles.overlay} data-birthday-modal role="dialog" aria-modal="true" aria-label={"Birthday surprise for " + name}>
          <div className={styles.paper}>
            <button ref={closeRef} type="button" className={styles.close} onClick={dismiss} aria-label="Skip birthday celebration">Skip <span aria-hidden="true">×</span></button>
            <button type="button" className={styles.sound} onClick={() => {
              setMusicMuted(v => {
                const muted = !v;
                if (musicRef.current) { musicRef.current.muted = muted; if (!muted && hasStarted) void musicRef.current.play().catch(() => undefined); }
                return muted;
              });
            }} aria-label={musicMuted ? "Turn birthday music on" : "Turn birthday music off"}>{musicMuted ? "Music off" : "Music on"} <span aria-hidden="true">{musicMuted ? "◌" : "♫"}</span></button>
            <audio ref={musicRef} src="/birthday-magic/ambient.mp3" preload="none" loop muted={musicMuted} aria-hidden="true" />
            <audio ref={voiceRef} preload="none" aria-hidden="true" />

            {scene === "welcome" && (
              <div className={styles.screen}>
                {welcomePhotoAvailable && <img src="/birthday-magic/welcome.webp" alt="" className={styles.backdrop} onError={() => setWelcomePhotoAvailable(false)} />}
                <div className={styles.fallbackWarmth} />
                <div className={styles.welcomeCopy}>
                  <p className={styles.eyebrow}>FC ARENA · JUST FOR YOU</p>
                  <div className={styles.deco} aria-hidden="true">✦</div>
                  <h2>A little <em>birthday</em><br />magic.</h2>
                  <p>Hey <strong>{name}</strong>, we saved a special moment for you.</p>
                  <button className={styles.primary} type="button" onClick={start}>Open my surprise <span aria-hidden="true">→</span></button>
                </div>
              </div>
            )}

            {scene === "film" && (
              <div className={styles.film}>
                <video ref={filmRef} src="/birthday-magic/stadium.mp4" playsInline preload="metadata" poster="/brand/dashboard-stadium.webp"
                  onEnded={() => setScene("cake")} onError={() => { setVideoAvailable(false); setScene("cake"); }} />
                <div className={styles.filmCopy}>
                  <p>FC ARENA PRESENTS</p>
                  {portrait && <img className={styles.filmAvatar} src={portrait} alt="" />}
                  <h2>{name}</h2>
                  <strong>HAPPY BIRTHDAY</strong>
                  <button type="button" onClick={() => setScene("cake")}>Continue to your cake →</button>
                </div>
              </div>
            )}

            {scene === "cake" && (
              <div className={styles.screen}>
                {cakePhotoAvailable && <img className={styles.backdrop} src="/birthday-magic/cake.webp" alt="An elegant birthday cake with lit candles" onError={() => setCakePhotoAvailable(false)} />}
                {!cakePhotoAvailable && <div className={`${styles.cakeStage} ${cakeCut ? styles.cakeSliced : ""}`} role="img" aria-label="Pastel pink birthday cake with three candles">
                  <div className={styles.cakeGround} /><div className={styles.cakeStand} /><div className={styles.cakePedestal} />
                  <div className={styles.cakeBody}><i className={styles.cakeRibbon} /><i className={styles.cakeLace} /></div>
                  <div className={styles.cakeTop} /><div className={styles.berries}><i /><i /><i /></div>
                  <div className={styles.candles}>{[0, 1, 2].map(index => <span className={styles.candle} key={index}>{!candlesOut && <i className={styles.flame} />}</span>)}</div>
                  <div className={styles.cakeSlice} />
                </div>}
                <div className={styles.fallbackWarmth} />
                <div className={styles.cakeCopy}>
                  <p className={styles.eyebrow}>A MOMENT TO REMEMBER</p>
                  <h2>Make a wish,<br /><em>{name}.</em></h2>
                  <p>Close your eyes for a second. Think of something beautiful.</p>
                </div>
                <div className={styles.cakeActions}>
                  {!candlesOut ? (
                    <button type="button" className={styles.primary} onClick={() => setCandlesOut(true)}>Blow out the candles <span aria-hidden="true">✧</span></button>
                  ) : (
                    <>
                      <p className={styles.wishNote} aria-live="polite">Wish made. May beautiful things find you. ♥</p>
                      <button type="button" className={styles.primary} onClick={cutCake}>{cakeCut ? "Read your birthday note" : "Cut your birthday cake"} <span aria-hidden="true">♡</span></button>
                    </>
                  )}
                </div>
              </div>
            )}

            {scene === "letter" && (
              <div className={styles.letter}>
                <p className={styles.eyebrow}>WITH LOVE, FROM YOUR FC ARENA FAMILY</p>
                <div className={styles.deco} aria-hidden="true">✧</div>
                <h2>Happy birthday,<br /><em>{name}.</em></h2>
                <p>To another year of great matches, little joys, unforgettable friendships and moments worth celebrating.</p>
                <p>We&apos;re really glad you&apos;re part of our ARENA. Today, we celebrate <strong>you.</strong></p>
                <strong className={styles.signature}>With love, FC ARENA <span aria-hidden="true">♥</span></strong>
                <button type="button" className={styles.primary} onClick={() => setScene("gift")}>One more thing… <span aria-hidden="true">→</span></button>
              </div>
            )}

            {scene === "gift" && (
              <div className={styles.gift}>
                <span className={styles.ribbon} aria-hidden="true">✳</span>
                <p className={styles.eyebrow}>A SMALL GIFT, JUST FOR YOU</p>
                <h2>Your day,<br /><em>your story.</em></h2>
                <p>Today your FC ARENA home wears a little birthday magic. Come back and relive this whenever you like.</p>
                <div className={styles.profileChip}>
                  {portrait ? <img src={portrait} alt="" /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
                  <div><strong>{name}</strong><small>{leagueName || "FC ARENA PLAYER"} · BIRTHDAY EDITION</small></div>
                </div>
                <button type="button" className={styles.primary} onClick={dismiss}>Back to my ARENA <span aria-hidden="true">→</span></button>
                <small className={styles.disclaimer}>Celebration only. No coins, rankings or match records are changed.</small>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
