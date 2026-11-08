"use client";
import { useRouteLeague } from '@/lib/active-league';
import { useAppRefresh } from '@/lib/app-refresh';

/* eslint-disable react-hooks/exhaustive-deps -- Data-loading effects are intentionally keyed by resource identifiers; loader callback identity must not retrigger network work. */

import { TournamentFormatGuide } from '@/components/tournaments/tournament-format-guide';
import type { TournamentFormatDescription } from '@/lib/tournament-format-guide';
import { useResultDraft } from "@/lib/result-draft";
import { ApiError } from "@/lib/api";
import { confirmAction, promptAction } from "@/components/fc/confirmation-provider";
import { FcCrest, FcEmptyState, FcErrorState, FcLoadingScreen, FcNotice } from "@/components/fc/fc-ui";
import { PremiumPitch } from "@/components/fc/premium-ui";
import { ShareCard } from "@/components/fc/share-card";
import { MatchReminder } from "@/components/fc/match-reminder";
import { PenaltyInputs, readPenaltyScores } from "@/components/matches/penalty-inputs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AppShell } from "@/components/app/app-shell";

import {
  authenticatedRequest,
  authenticatedUpload,
  type CurrentUser,
  type RealtimeConnectionState,
  getCurrentUser,
  subscribeAuthenticatedEvents,
} from "@/lib/auth-client";

interface MatchEntry {
  id: string;
  entryName: string | null;

  members: Array<{
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
  }>;
}

interface MatchCenter {
  id: string;
  matchCode: string | null;
  status: string;
  isLeagueAdmin: boolean;
  isParticipant: boolean;
  participantSide: "HOME" | "AWAY" | null;
  returnLeg?: {
    canUpload: boolean;
    firstLegMatchId: string | null;
    firstLegFixtureCode: string | null;
    firstLegScore: { homeScore: number; awayScore: number } | null;
    message: string | null;
  } | null;

  readiness: {
    homeReadyAt: string | null;
    awayReadyAt: string | null;
    homeReady: boolean;
    awayReady: boolean;
    bothReady: boolean;
  };

  schedule: {
    scheduledAt: string | null;
    estimatedDeadlineAt: string | null;
    matchDurationMinutes: number;
  };

  tournament: {
    id: string;
    name: string;
    mode: string;
    format: string;
    competitionFormat?: string;
    formatGuide?: TournamentFormatDescription | null;
  };

  league: {
    id: string;
    name: string;
    code: string;
  };

  fixture: {
    id: string;
    fixtureCode: string;
    roundName: string;
    roundNumber: number;
    matchday: number | null;
    scheduledAt: string | null;
    venue: string | null;
    status: string;

    home: MatchEntry | null;
    away: MatchEntry | null;

    homeSource: string | null;
    awaySource: string | null;
  };
}

interface ResultSubmission {
  id: string;
  homeScore: number;
  awayScore: number;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
  status: string;
  source?: string;
  rejectionReason: string | null;
  createdAt: string;

  submittedBy: {
    id: string;
    fullName: string;

    player: {
      playerCode: string;

      identity: {
        inGameName: string;
      } | null;
    } | null;
  };

  reviewedBy: {
    id: string;
    fullName: string;
  } | null;
}

interface MatchedOcrUser {
  id: string;
  fullName: string;

  player: {
    playerCode: string;

    identity: {
      inGameName: string;
    } | null;
  } | null;
}

interface OcrExtraction {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;

  rawText: string | null;
  ocrConfidence: number | null;

  detectedHomeName: string | null;

  detectedAwayName: string | null;

  detectedHomeScore: number | null;

  detectedAwayScore: number | null;

  homeNameConfidence: number | null;

  awayNameConfidence: number | null;

  scoreConfidence: number | null;

  failureReason: string | null;

  processedAt: string | null;

  createdAt: string;

  homeMatchedUser: MatchedOcrUser | null;

  awayMatchedUser: MatchedOcrUser | null;

  resultSubmission: {
    id: string;
    status: string;
  } | null;
}

function entryName(entry: MatchEntry | null, source: string | null) {
  if (entry?.entryName) {
    return entry.entryName;
  }

  if (entry) {
    return entry.members
      .map((member) => member.inGameName || member.fullName)
      .join(" + ");
  }

  if (source) {
    return `Winner of ${source}`;
  }

  return "TBD";
}

function supportsPenaltyScores(match: MatchCenter) {
  return match.tournament.competitionFormat === 'UCL_CUP' && match.fixture.roundName.startsWith('UCL ') && match.fixture.matchday !== 1;
}

function percentage(confidence: number | null) {
  if (confidence === null) {
    return "—";
  }

  return `${Math.round(confidence * 100)}%`;
}

function confidenceLabel(confidence: number | null) {
  if (confidence === null) {
    return "Unknown";
  }

  if (confidence >= 0.85) {
    return "High Confidence";
  }

  if (confidence >= 0.5) {
    return "Needs Review";
  }

  return "Manual Check Required";
}

function confidenceClass(confidence: number | null) {
  if (confidence === null) {
    return "border-white/10 bg-white/5 text-slate-400";
  }

  if (confidence >= 0.85) {
    return "border-emerald-400/20 bg-emerald-400/5 text-emerald-300";
  }

  if (confidence >= 0.5) {
    return "border-amber-400/20 bg-amber-400/5 text-amber-300";
  }

  return "border-red-400/20 bg-red-400/5 text-red-300";
}

function formatCountdown(target: string | null, now: number) {
  if (!target) {
    return null;
  }

  const targetMs = new Date(target).getTime();

  if (Number.isNaN(targetMs)) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor((targetMs - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function realtimeBadgeClass(state: RealtimeConnectionState) {
  if (state === "connected") {
    return "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300";
  }

  if (state === "reconnecting" || state === "connecting") {
    return "border-amber-400/20 bg-amber-400/[0.07] text-amber-300";
  }

  return "border-white/10 bg-white/[0.04] text-slate-500";
}

function MatchScheduleLabel({ schedule, status }: { schedule: MatchCenter['schedule']; status: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status === 'COMPLETED' || status === 'CANCELLED') return;
    const target = Math.max(new Date(schedule.scheduledAt ?? '').getTime() || 0, new Date(schedule.estimatedDeadlineAt ?? '').getTime() || 0);
    if (target <= Date.now()) return;
    const update = () => { if (document.visibilityState !== 'hidden') setNow(Date.now()); };
    const timer = window.setInterval(update, 1_000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [schedule.scheduledAt, schedule.estimatedDeadlineAt, status]);
  if (status === 'COMPLETED') return <>Match completed</>;
  if (status === 'CANCELLED') return <>Match cancelled</>;
  const start = new Date(schedule.scheduledAt ?? '').getTime(), deadline = new Date(schedule.estimatedDeadlineAt ?? '').getTime();
  return <>{!Number.isFinite(start) ? 'Schedule pending' : now < start ? `Starts in ${formatCountdown(schedule.scheduledAt, now)}`
    : Number.isFinite(deadline) && now < deadline ? `Match window · ${formatCountdown(schedule.estimatedDeadlineAt, now)} left` : 'Scheduled match window ended'}</>;
}

export default function MatchRoomPage() {
  const params = useParams<{ matchId: string }>();
  return <MatchRoom key={params.matchId} />;
}

function MatchRoom() {
  const params = useParams<{
    matchId: string;
  }>();

  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [match, setMatch] = useState<MatchCenter | null>(null);

  const [submissions, setSubmissions] = useState<ResultSubmission[]>([]);

  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false);

  const [latestOcr, setLatestOcr] = useState<OcrExtraction | null>(null);

  const [uploadProgress, setUploadProgress] = useState(0);

  const draft = useResultDraft(user && match ? `${user.id}:${match.id}` : '',
    match ? `${match.fixture.id}:${match.fixture.home?.id}:${match.fixture.away?.id}` : '');
  const ocrValues = draft.ocr.extractionId === latestOcr?.id ? draft.ocr : {
    homeScore: (latestOcr?.scoreConfidence ?? 0) >= 0.5 && latestOcr?.detectedHomeScore != null ? String(latestOcr.detectedHomeScore) : '',
    awayScore: (latestOcr?.scoreConfidence ?? 0) >= 0.5 && latestOcr?.detectedAwayScore != null ? String(latestOcr.detectedAwayScore) : '',
    homePenaltyScore: '', awayPenaltyScore: '',
  };
  const ocrHomeScore = ocrValues.homeScore, ocrAwayScore = ocrValues.awayScore;
  const setOcrHomeScore = (value: string) => latestOcr && draft.setOcr(latestOcr.id, { ...ocrValues, homeScore: value });
  const setOcrAwayScore = (value: string) => latestOcr && draft.setOcr(latestOcr.id, { ...ocrValues, awayScore: value });
  const hasDraft = Boolean(draft.file || Object.values(draft.manual).some(Boolean) || draft.ocr.extractionId);
  useEffect(() => {
    if (draft.ready && hasDraft && (confirmedId || submissions.some(item => item.status === 'PENDING_VERIFICATION' && item.submittedBy.id === user?.id))) draft.clear();
  }, [draft.ready, hasDraft, confirmedId, submissions, user?.id]);

  const [busy, setBusy] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [realtimeState, setRealtimeState] =
    useState<RealtimeConnectionState>("connecting");

  const [retry, setRetry] = useState(0);
  const readEpoch = useRef({ match: 0, results: 0, ocr: 0 });

  useRouteLeague(user?.id, match?.id === params.matchId ? match.league.id : null);

  async function loadMatch(signal?: AbortSignal) {
    const epoch = ++readEpoch.current.match;
    const response = await authenticatedRequest<{
      success: true;

      data: {
        match: MatchCenter;
      };

      error: null;
    }>(`/matches/${params.matchId}`, signal ? { signal } : {});
    if (signal?.aborted || epoch !== readEpoch.current.match) return;
    setMatch(response.data.match);
  }

  async function loadResults(signal?: AbortSignal) {
    const epoch = ++readEpoch.current.results;
    const response = await authenticatedRequest<{
      success: true;

      data: {
        isLeagueAdmin: boolean;

        canVerifyResult: boolean;

        confirmedResultSubmissionId: string | null;

        submissions: ResultSubmission[];
      };

      error: null;
    }>(`/matches/${params.matchId}/results`, signal ? { signal } : {});
    if (signal?.aborted || epoch !== readEpoch.current.results) return;
    setSubmissions(response.data.submissions);

    setConfirmedId(response.data.confirmedResultSubmissionId);

    setIsLeagueAdmin(
      response.data.canVerifyResult,
    );
  }

  async function loadLatestOcr(signal?: AbortSignal) {
    const epoch = ++readEpoch.current.ocr;
    const response = await authenticatedRequest<{
      success: true;

      data: {
        extraction: OcrExtraction | null;
      };

      error: null;
    }>(`/matches/${params.matchId}/ocr/latest`, signal ? { signal } : {});
    if (signal?.aborted || epoch !== readEpoch.current.ocr) return;
    setLatestOcr(response.data.extraction);
  }

  async function refreshMatchCenter(signal?: AbortSignal) {
    await Promise.all([loadMatch(signal), loadResults(signal), loadLatestOcr(signal)]);
  }
  useAppRefresh(signal => refreshMatchCenter(signal), params.matchId);

  useEffect(() => {
    let active = true, loaded = false;
    const controller = new AbortController();
    async function load() {
      setError('');
      try {
        const [current] = await Promise.all([getCurrentUser({ signal: controller.signal }), refreshMatchCenter(controller.signal)]);
        if (active) { setUser(current); loaded = true; }
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(err instanceof ApiError ? err.message : 'Unable to load this Match Room. Please retry.');
      }
    }
    void load();
    const recover = () => { if (!loaded) setRetry(value => value + 1); };
    window.addEventListener('online', recover);
    return () => { active = false; controller.abort(); window.removeEventListener('online', recover); };
  }, [params.matchId, router, retry]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let refreshTimer: number | null = null;
    let hasConnected = false;
    const started = Date.now();
    const refresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void refreshMatchCenter().catch(() => undefined);
        window.dispatchEvent(new Event('fc-arena:notifications-changed'));
      }, 120);
    };

    const stop = subscribeAuthenticatedEvents(
      `/matches/${params.matchId}/events`,
      (event) => {
        const payload = event.data as {
          type?: string;
        } | null;

        if (!payload?.type || payload.type === "connected") {
          return;
        }

        refresh();
      },
      state => {
        setRealtimeState(state);
        if (state === 'connected') {
          if (hasConnected || Date.now() - started > 5_000) refresh();
          hasConnected = true;
        }
      },
    );

    return () => {
      stop();

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [user?.id, params.matchId]);

  useEffect(() => {
    if (!user || realtimeState === 'connected') return;
    const controller = new AbortController(); let pending = false;
    const timer = window.setInterval(() => {
      if (pending || navigator.onLine === false || document.visibilityState === 'hidden') return;
      pending = true;
      void refreshMatchCenter(controller.signal).catch(() => {}).finally(() => { pending = false; });
    }, 15_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [user?.id, realtimeState, params.matchId]);

  // Verification happens in another Match Room; listen there to unlock this leg.
  const firstLegMatchId = match?.returnLeg?.firstLegMatchId;
  const returnLegLocked = match?.returnLeg?.canUpload === false;
  useEffect(() => {
    if (!user || !returnLegLocked) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = () => {
      if (pending || navigator.onLine === false || document.visibilityState === 'hidden') return;
      pending = true;
      void loadMatch(controller.signal).catch(() => undefined).finally(() => { pending = false; });
    };
    const stop = firstLegMatchId ? subscribeAuthenticatedEvents(`/matches/${firstLegMatchId}/events`, refresh) : () => {};
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { stop(); controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [user?.id, returnLegLocked, firstLegMatchId, params.matchId]);

  useEffect(() => {
    if (latestOcr?.status !== 'QUEUED' && latestOcr?.status !== 'PROCESSING') return;
    let active = true, pending = false, delay = 2_000;
    let timer: number | undefined;
    const controller = new AbortController();
    const poll = async () => {
      if (!active || pending) return;
      if (navigator.onLine !== false && document.visibilityState !== 'hidden') {
        pending = true;
        try { await loadLatestOcr(controller.signal); delay = 2_000; }
        catch { delay = Math.min(delay * 2, 10_000); }
        finally { pending = false; }
      }
      if (active) timer = window.setTimeout(poll, delay);
    };
    const resume = () => {
      if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
      if (timer !== undefined) window.clearTimeout(timer);
      void poll();
    };
    timer = window.setTimeout(poll, delay);
    window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    return () => { active = false; controller.abort(); if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [latestOcr?.status, params.matchId]);

  async function setReady(
    side: "HOME" | "AWAY" | undefined,
    ready: boolean,
  ) {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await authenticatedRequest<{
        success: true;
        data: {
          message: string;
        };
        error: null;
      }>(`/matches/${params.matchId}/ready`, {
        method: "POST",
        body: JSON.stringify({
          ready,
          ...(side ? { side } : {}),
        }),
      });

      setMessage(response.data.message);

      await loadMatch();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update Ready status.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitManualResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formElement = event.currentTarget;

    const data = new FormData(formElement);

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await authenticatedRequest<{
        success: true;

        data: {
          message: string;

          submission: {
            id: string;
          };
        };

        error: null;
      }>(`/matches/${params.matchId}/results`, {
        method: "POST",

        body: JSON.stringify({
          homeScore: Number(data.get("homeScore")),

          awayScore: Number(data.get("awayScore")),
          ...readPenaltyScores(data),
        }),
      });

      draft.clear();
      setMessage("Result received. Waiting for admin verification.");
      if (isLeagueAdmin) {
        const confirmedResponse = await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(`/results/${response.data.submission.id}/confirm`, {
          method: "POST",
        });

        setMessage(
          `${confirmedResponse.data.message} Player career stats and standings are now updated.`,
        );

        formElement.reset();

        await refreshMatchCenter();
      } else {
        setMessage(response.data.message);

        formElement.reset();

        await loadResults();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit result.");
      await loadResults().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function uploadScreenshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formElement = event.currentTarget;

    const screenshot = draft.file;

    if (!(screenshot instanceof File) || screenshot.size === 0) {
      setError("Select a result screenshot.");

      return;
    }

    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

    if (!allowed.has(screenshot.type)) {
      setError("Only JPG, PNG and WEBP screenshots are allowed.");

      return;
    }

    if (screenshot.size > 10 * 1024 * 1024) {
      setError("Screenshot must be 10 MB or smaller.");

      return;
    }

    const uploadBody = new FormData();

    uploadBody.append("screenshot", screenshot);

    setBusy(true);
    setMessage("");
    setError("");
    setUploadProgress(0);

    try {
      const response = await authenticatedUpload<{
        success: true;

        data: {
          message: string;

          extraction: {
            id: string;
            status: string;
          };
        };

        error: null;
      }>(`/matches/${params.matchId}/ocr`, uploadBody, (progress) =>
        setUploadProgress(progress),
      );

      draft.setFile(null);
      setUploadProgress(100);

      setMessage(response.data.message);

      formElement.reset();

      await loadLatestOcr();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Screenshot upload failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitOcrResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const penaltyScores = readPenaltyScores(new FormData(event.currentTarget));

    if (!latestOcr) {
      return;
    }

    if (ocrHomeScore === "" || ocrAwayScore === "") {
      setError("Enter both scores before submitting.");

      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await authenticatedRequest<{
        success: true;

        data: {
          message: string;

          submission: {
            id: string;
          };
        };

        error: null;
      }>(`/ocr/${latestOcr.id}/submit-result`, {
        method: "POST",

        body: JSON.stringify({
          homeScore: Number(ocrHomeScore),

          awayScore: Number(ocrAwayScore),
          ...penaltyScores,
        }),
      });

      draft.clear();
      setMessage("Result received. Waiting for admin verification.");
      if (isLeagueAdmin) {
        const confirmedResponse = await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(`/results/${response.data.submission.id}/confirm`, {
          method: "POST",
        });

        setMessage(
          `${confirmedResponse.data.message} The reviewed scores are now reflected in standings and player career statistics.`,
        );

        await refreshMatchCenter();
      } else {
        setMessage(response.data.message);

        await Promise.all([loadLatestOcr(), loadResults()]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to submit OCR result.",
      );
      await loadResults().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function confirmResult(submissionId: string) {
    if (
      !(await confirmAction(
        { title: 'Confirm result?', description: 'Confirm this result? Player statistics and tournament standings will be updated.', confirmLabel: 'Confirm result' },
      ))
    ) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await authenticatedRequest<{
        success: true;

        data: {
          message: string;
        };

        error: null;
      }>(`/results/${submissionId}/confirm`, {
        method: "POST",
      });

      setMessage(response.data.message);

      await refreshMatchCenter();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to confirm result.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function rejectResult(submissionId: string) {
    const reason = await promptAction({ title: 'Reject result?', description: 'Reject this submitted result? You can add a reason to explain the decision.', label: 'Rejection reason', confirmLabel: 'Reject result', destructive: true });

    if (reason === null) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await authenticatedRequest<{
        success: true;

        data: {
          message: string;
        };

        error: null;
      }>(`/results/${submissionId}/reject`, {
        method: "POST",

        body: JSON.stringify({
          reason: reason || undefined,
        }),
      });

      setMessage(response.data.message);

      await loadResults();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reject result.");
    } finally {
      setBusy(false);
    }
  }

  async function correctResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    const homeScore = Number(data.get("correctedHomeScore"));

    const awayScore = Number(data.get("correctedAwayScore"));

    const reason = String(data.get("correctionReason") ?? "").trim();

    if (reason.length < 3) {
      setError("Correction reason must contain at least 3 characters.");

      return;
    }

    if (
      !(await confirmAction({ title: 'Correct result?', description: `Replace the confirmed score with ${homeScore}-${awayScore}? Player statistics and tournament standings will be recalculated.`, confirmLabel: 'Correct result' }))
    ) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await authenticatedRequest<{
        success: true;

        data: {
          message: string;
        };

        error: null;
      }>(`/matches/${params.matchId}/results/correct`, {
        method: "POST",

        body: JSON.stringify({
          homeScore,
          awayScore,
          reason,
          ...readPenaltyScores(data, 'corrected'),
        }),
      });

      setMessage(response.data.message);

      await refreshMatchCenter();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to correct result.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reverseConfirmedResult() {
    const reason = await promptAction({ title: 'Reverse confirmed result?', description: 'Reversing this result removes its statistics and updates the tournament standings. Explain why this result needs to be reversed.', label: 'Reversal reason', required: true, confirmLabel: 'Continue', destructive: true, validate: value => value.trim().length < 3 ? 'Reversal reason must contain at least 3 characters.' : undefined });

    if (reason === null) {
      return;
    }

    if (reason.trim().length < 3) {
      setError("Reversal reason must contain at least 3 characters.");

      return;
    }

    if (
      !(await confirmAction(
        { title: 'Reverse confirmed result?', description: 'Reverse this confirmed result and remove its contribution to player statistics and tournament standings?', confirmLabel: 'Reverse result', destructive: true },
      ))
    ) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await authenticatedRequest<{
        success: true;

        data: {
          message: string;
        };

        error: null;
      }>(`/matches/${params.matchId}/results/reverse`, {
        method: "POST",

        body: JSON.stringify({
          reason: reason.trim(),
        }),
      });

      setMessage(response.data.message);

      await refreshMatchCenter();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to reverse result.",
      );
    } finally {
      setBusy(false);
    }
  }

  if ((!user || !match) && error)
    return (
      <AppShell>
        <FcErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
      </AppShell>
    );

  if (!user || !match) {
    return (
      <FcLoadingScreen label="Loading Match Room..." />
    );
  }

  const home = entryName(match.fixture.home, match.fixture.homeSource);

  const away = entryName(match.fixture.away, match.fixture.awaySource);

  const confirmed = submissions.find(
    (submission) => submission.id === confirmedId,
  );

  const canSubmit =
    !confirmedId &&
    (match.isParticipant || isLeagueAdmin) &&
    !submissions.some(item => item.status === 'PENDING_VERIFICATION') &&
    !returnLegLocked &&
    (match.status === "UNSCHEDULED" ||
      match.status === "SCHEDULED" ||
      match.status === "LIVE");

  const ocrProcessing =
    latestOcr?.status === "QUEUED" || latestOcr?.status === "PROCESSING";

  const canSubmitOcr =
    canSubmit &&
    latestOcr?.status === "COMPLETED" &&
    !latestOcr.resultSubmission &&
    !confirmedId;

  const awaitingReview =
    !confirmed &&
    submissions.some(
      (item) => item.status === "PENDING_VERIFICATION",
    );

  const participantReady =
    match.participantSide === "HOME"
      ? match.readiness.homeReady
      : match.participantSide === "AWAY"
        ? match.readiness.awayReady
        : false;

  return (
    <AppShell currentUser={user} playerName={user.player?.identity?.inGameName}>
      <div className="premium-match-center space-y-6">
        <TournamentFormatGuide guide={match.tournament.formatGuide} compact />
        {returnLegLocked ? (
          <section className="theme-card rounded-2xl border p-5" role="status" aria-label="Second leg locked">
            <h2 className="theme-text font-bold">Second leg locked · first-leg verification required</h2>
            <p className="theme-muted mt-2 text-sm">{match.returnLeg?.message}</p>
            {firstLegMatchId ? <Link className="theme-primary-button mt-3 inline-flex rounded-xl px-4 py-3 text-sm" href={`/matches/${firstLegMatchId}`}>Open first leg {match.returnLeg?.firstLegFixtureCode}</Link> : null}
          </section>
        ) : match.returnLeg?.firstLegScore ? (
          <p className="theme-muted text-sm" role="status">Verified first leg: {home} {match.returnLeg.firstLegScore.homeScore} – {match.returnLeg.firstLegScore.awayScore} {away}. The aggregate of both legs decides the winner.</p>
        ) : null}
        {canSubmit ? <div className="theme-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" aria-label="Result draft">
          <p className="theme-muted text-sm" role="status">{draft.status || 'Scores and screenshots are saved on this device for 7 days.'}</p>
          {hasDraft ? <button type="button" disabled={busy} className="theme-text min-h-11 px-3 text-sm font-bold" onClick={async () => {
            if (await confirmAction({ title: 'Discard saved draft?', description: 'Remove the scores and selected screenshot saved on this device?', confirmLabel: 'Discard draft' })) draft.clear();
          }}>Discard draft</button> : null}
        </div> : null}
        <div className="premium-match-links flex flex-wrap gap-4">
          <Link
            href={`/tournaments/${match.tournament.id}`}
            className="text-sm font-bold text-slate-500 hover:text-white"
          >
            ← Back to Tournament
          </Link>

          <Link
            href={`/tournaments/${match.tournament.id}/standings`}
            className="text-sm font-bold text-sky-400"
          >
            View Standings →
          </Link>
        </div>

        <section className="premium-hero premium-scoreboard">
          <PremiumPitch />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="premium-eyebrow">
                Match Center
              </p>

              <h1 className="mt-3 break-words text-xl font-semibold md:text-3xl">
                {match.tournament.name}
              </h1>

              <div className="premium-match-context"><span>{match.fixture.roundName}</span><span>{match.status.replaceAll("_", " ")}</span><span>{match.matchCode || match.fixture.fixtureCode}</span></div>
            </div>

            <div className="premium-countdown rounded-2xl border px-4 py-3 text-right">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                Live Countdown
              </p>
              <p className="mt-1 text-sm font-black text-sky-300">
                <MatchScheduleLabel schedule={match.schedule} status={match.status} />
              </p>
            </div>
          </div>

          <div className="fc-match-room-score-grid relative mt-9 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5">
            <div className="min-w-0 text-center">
              <p className="theme-secondary-text mb-2 text-[10px] font-semibold uppercase tracking-wider">Home</p>
              <FcCrest name={home} size="lg" />
              <p className="break-words text-lg font-black md:text-3xl">
                {home}
              </p>

              <p
                className={
                  match.readiness.homeReady
                    ? "mt-3 text-[10px] font-black uppercase tracking-wider text-emerald-300"
                    : "mt-3 text-[10px] font-black uppercase tracking-wider text-slate-600"
                }
              >
                {match.readiness.homeReady ? "✓ Ready" : "Not Ready"}
              </p>

              {confirmed ? (
                <p className="mt-5 text-5xl font-black text-sky-400 md:text-6xl">
                  {confirmed.homeScore}
                </p>
              ) : null}
            </div>

            <div className="text-center">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-3 font-black text-slate-500">
                {confirmed ? "FT" : "VS"}
              </div>

              {match.readiness.bothReady && !confirmed ? (
                <p className="mt-3 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                  Both Ready
                </p>
              ) : null}
            </div>

            <div className="min-w-0 text-center">
              <p className="theme-secondary-text mb-2 text-[10px] font-semibold uppercase tracking-wider">Away</p>
              <FcCrest name={away} size="lg" />
              <p className="break-words text-lg font-black md:text-3xl">
                {away}
              </p>

              <p
                className={
                  match.readiness.awayReady
                    ? "mt-3 text-[10px] font-black uppercase tracking-wider text-emerald-300"
                    : "mt-3 text-[10px] font-black uppercase tracking-wider text-slate-600"
                }
              >
                {match.readiness.awayReady ? "✓ Ready" : "Not Ready"}
              </p>

              {confirmed ? (
                <p className="mt-5 text-5xl font-black text-sky-400 md:text-6xl">
                  {confirmed.awayScore}
                </p>
              ) : null}
            </div>
          </div>

          {!confirmed &&
          (match.isParticipant || match.isLeagueAdmin) &&
          ["UNSCHEDULED", "SCHEDULED"].includes(match.status) ? (
            <div className="premium-readiness relative mt-8 rounded-xl border p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-200">
                    Ready to Play
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Mark Ready when your side is available. Both players can see the status instantly.
                  </p>
                </div>

                {match.isParticipant && match.participantSide ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void setReady(
                        undefined,
                        !participantReady,
                      )
                    }
                    className={
                      participantReady
                        ? "min-h-11 rounded-xl border border-white/10 px-5 text-sm font-black text-slate-400 disabled:opacity-40"
                        : "min-h-11 rounded-xl bg-emerald-400 px-5 text-sm font-black text-[#04130d] disabled:opacity-40"
                    }
                  >
                    {participantReady ? "Set Not Ready" : "✓ I’m Ready"}
                  </button>
                ) : match.isLeagueAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void setReady(
                          "HOME",
                          !match.readiness.homeReady,
                        )
                      }
                      className="min-h-10 rounded-xl border border-white/10 px-4 text-xs font-black text-slate-300 disabled:opacity-40"
                    >
                      HOME · {match.readiness.homeReady ? "Clear Ready" : "Set Ready"}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void setReady(
                          "AWAY",
                          !match.readiness.awayReady,
                        )
                      }
                      className="min-h-10 rounded-xl border border-white/10 px-4 text-xs font-black text-slate-300 disabled:opacity-40"
                    >
                      AWAY · {match.readiness.awayReady ? "Clear Ready" : "Set Ready"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="premium-match-task">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${realtimeBadgeClass(realtimeState)}`}>
                  {realtimeState === "connected" ? "● LIVE SYNC" : realtimeState === "reconnecting" ? "● RECONNECTING" : realtimeState === "connecting" ? "● CONNECTING" : "● OFFLINE"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{match.status.replaceAll("_", " ")}</span>
              </div>
              <p className="mt-3 text-sm font-semibold">{confirmed ? "Verified result · Match Room locked" : awaitingReview ? "Result submitted · awaiting verification" : match.readiness.bothReady ? "Both sides Ready · play the match" : canSubmit ? "Match Room active" : "Match details"}</p>
              <p className="mt-1 text-xs text-slate-500"><MatchScheduleLabel schedule={match.schedule} status={match.status} /></p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!confirmed && (awaitingReview || canSubmit) ? <a className="theme-primary-button rounded-xl px-4 py-3 text-sm" href={awaitingReview ? "#result-verification" : "#result-entry"}>{awaitingReview ? "Review submissions" : "Enter score"}</a> : null}
              {confirmed?.homePenaltyScore != null && confirmed.awayPenaltyScore != null ? <p className="mt-3 text-sm font-bold text-sky-300">Penalties {confirmed.homePenaltyScore}–{confirmed.awayPenaltyScore} · {confirmed.homePenaltyScore > confirmed.awayPenaltyScore ? home : away} win</p> : null}
              {confirmed ? <ShareCard label="Share result card" filename="fc-arena-result" title={`${home} ${confirmed.homeScore} – ${confirmed.awayScore} ${away}`} lines={[match.tournament.name, confirmed.homePenaltyScore != null ? `Penalties ${confirmed.homePenaltyScore}–${confirmed.awayPenaltyScore}` : "Verified result", match.matchCode || "FC ARENA Match"]} /> : null}
              <MatchReminder title={`${home} vs ${away}`} scheduledAt={match.fixture.scheduledAt} matchId={String(params.matchId)} />
            </div>
          </div>
        </section>
        <FcNotice>{message}</FcNotice>
        <FcNotice tone="error">{error}</FcNotice>

        <details className="fc-help-disclosure"><summary>Schedule, round &amp; venue</summary>
        <section className="fc-match-room-meta mt-3 grid grid-cols-1 gap-3 md:grid-cols-4" aria-label="Match metadata">
          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">Round</p>

            <p className="mt-2 font-black">{match.fixture.roundName}</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">Matchday</p>

            <p className="mt-2 font-black">{match.fixture.matchday ?? "—"}</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">Date & Time</p>

            <p className="mt-2 font-black">
              {match.fixture.scheduledAt
                ? new Date(match.fixture.scheduledAt).toLocaleString()
                : "Not scheduled"}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">Venue</p>

            <p className="mt-2 font-black">{match.fixture.venue || "—"}</p>
          </article>
        </section>
        </details>

        {canSubmit ? (
          <details
            id="result-update"
            className="scroll-mt-24 rounded-[26px] border border-sky-400/20 bg-[#0a1018] p-6"
          >
            <summary className="cursor-pointer text-lg font-semibold">Upload a screenshot instead</summary>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
              AI Result Scanner
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Upload Match Screenshot
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Upload the FC Mobile result screenshot. FC ARENA scans the score
              and in-game names, matches them only against the players
              registered in this Match, and prepares the result for
              verification. Once confirmed, standings and each matched player&apos;s
              career statistics update automatically.
            </p>

            <form onSubmit={uploadScreenshot} className="mt-6 grid gap-4">
              <input
                name="screenshot"
                key={draft.file?.name ?? 'empty-screenshot'}
                aria-label="Match result screenshot"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required={!draft.file}
                disabled={!draft.ready || busy}
                onChange={event => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) {
                    setError('Choose a JPG, PNG or WEBP screenshot, 10 MB or smaller.'); event.target.value = ''; return;
                  }
                  draft.setFile(file);
                }}
                className="rounded-xl border border-dashed border-white/15 bg-black/10 p-4 text-sm"
              />

              {draft.file ? <p className="theme-muted break-words text-sm">Selected screenshot: {draft.file.name} · {(draft.file.size / 1024).toFixed(0)} KB</p> : null}
              {uploadProgress > 0 ? (
                <div>
                  <div className="mb-2 flex justify-between text-xs text-slate-500">
                    <span>Upload</span>

                    <span>{uploadProgress}%</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full bg-sky-400 transition-all"
                      style={{
                        width: `${uploadProgress}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              <button
                disabled={busy || ocrProcessing || !draft.ready}
                className="rounded-xl bg-sky-400 px-5 py-3 font-black text-[#041019] disabled:opacity-50"
              >
                {ocrProcessing
                  ? "Processing Match Result..."
                  : "Upload & Scan Screenshot"}
              </button>
            </form>
          </details>
        ) : null}

        {latestOcr ? (
          <section className="rounded-[26px] border border-white/10 bg-[#0a1018] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
                  OCR Verification
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Screenshot Analysis
                </h2>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black">
                {latestOcr.status.replaceAll("_", " ")}
              </span>
            </div>

            {ocrProcessing ? (
              <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-6 text-center">
                <p className="font-black text-sky-300">
                  Processing Match Result...
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  OCR worker is analysing the screenshot.
                </p>
              </div>
            ) : null}

            {latestOcr.status === "FAILED" ? (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-red-300">
                <p className="font-black">OCR processing failed</p>

                <p className="mt-2 text-sm">
                  {latestOcr.failureReason || "Unknown OCR error."}
                </p>
              </div>
            ) : null}

            {latestOcr.status === "COMPLETED" ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  <article
                    className={`rounded-2xl border p-5 ${confidenceClass(
                      latestOcr.homeNameConfidence,
                    )}`}
                  >
                    <p className="text-xs font-black uppercase">Home Name</p>

                    <p className="mt-3 font-mono text-sm">
                      {latestOcr.detectedHomeName || "Not detected"}
                    </p>

                    <p className="mt-3 text-lg font-black">
                      {latestOcr.homeMatchedUser?.player?.identity
                        ?.inGameName ||
                        latestOcr.homeMatchedUser?.fullName ||
                        "Manual verification"}
                    </p>

                    <p className="mt-2 text-xs">
                      {confidenceLabel(latestOcr.homeNameConfidence)} •{" "}
                      {percentage(latestOcr.homeNameConfidence)}
                    </p>
                  </article>

                  <article
                    className={`rounded-2xl border p-5 ${confidenceClass(
                      latestOcr.scoreConfidence,
                    )}`}
                  >
                    <p className="text-xs font-black uppercase">
                      Score Detection
                    </p>

                    <p className="mt-5 text-center text-4xl font-black">
                      {latestOcr.detectedHomeScore ?? "?"}
                      {" - "}
                      {latestOcr.detectedAwayScore ?? "?"}
                    </p>

                    <p className="mt-4 text-center text-xs">
                      {confidenceLabel(latestOcr.scoreConfidence)} •{" "}
                      {percentage(latestOcr.scoreConfidence)}
                    </p>
                  </article>

                  <article
                    className={`rounded-2xl border p-5 ${confidenceClass(
                      latestOcr.awayNameConfidence,
                    )}`}
                  >
                    <p className="text-xs font-black uppercase">Away Name</p>

                    <p className="mt-3 font-mono text-sm">
                      {latestOcr.detectedAwayName || "Not detected"}
                    </p>

                    <p className="mt-3 text-lg font-black">
                      {latestOcr.awayMatchedUser?.player?.identity
                        ?.inGameName ||
                        latestOcr.awayMatchedUser?.fullName ||
                        "Manual verification"}
                    </p>

                    <p className="mt-2 text-xs">
                      {confidenceLabel(latestOcr.awayNameConfidence)} •{" "}
                      {percentage(latestOcr.awayNameConfidence)}
                    </p>
                  </article>
                </div>

                {(latestOcr.scoreConfidence ?? 0) < 0.5 ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-300">
                    The score or home/away order could not be verified reliably.
                    Check the screenshot and enter each team&apos;s score below.
                  </div>
                ) : (latestOcr.scoreConfidence ?? 0) < 0.85 ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-300">
                    OCR confidence is moderate. Verify the score carefully
                    before submitting.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
                    OCR confidence is high. Human confirmation is still
                    required.
                  </div>
                )}

                {canSubmitOcr ? (
                  <form
                    onSubmit={submitOcrResult}
                    className="rounded-2xl border border-white/10 bg-black/10 p-5"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Verify Detected Result
                    </p>

                    {(latestOcr.scoreConfidence ?? 0) < 0.5 &&
                      latestOcr.detectedHomeScore !== null && latestOcr.detectedAwayScore !== null ? (
                      <div className="mt-4 grid gap-2" role="group" aria-label="Choose detected score order">
                        <p className="text-sm text-slate-400">Choose the correct team order, then review the scores below.</p>
                        {([false, true] as const).map((swapped) => {
                          const homeScore = swapped ? latestOcr.detectedAwayScore! : latestOcr.detectedHomeScore!;
                          const awayScore = swapped ? latestOcr.detectedHomeScore! : latestOcr.detectedAwayScore!;
                          if (swapped && homeScore === awayScore) return null;
                          return (
                            <button key={String(swapped)} type="button" disabled={busy}
                              onClick={() => { draft.setOcr(latestOcr.id, { ...ocrValues, homeScore: String(homeScore), awayScore: String(awayScore) }); }}
                              className="min-h-11 break-words rounded-xl border border-sky-400/20 px-3 py-3 text-sm font-bold text-sky-300 disabled:opacity-50">
                              Use {home} {homeScore} – {awayScore} {away}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
                      <label className="grid min-w-0 gap-2 break-words text-sm font-bold">
                        <span><span className="block text-xs text-slate-500">Home</span>{home}</span>

                        <input
                          value={ocrHomeScore}
                          disabled={!draft.ready || busy}
                          onChange={(event) =>
                            setOcrHomeScore(event.target.value)
                          }
                          type="number"
                          min="0"
                          max="99"
                          required
                          inputMode="numeric"
                          className="min-w-0 w-full rounded-xl border border-white/10 bg-[#080e15] px-3 py-3 text-center text-2xl font-black"
                        />
                      </label>

                      <span className="pb-4 font-black text-slate-600">-</span>

                      <label className="grid min-w-0 gap-2 break-words text-sm font-bold">
                        <span><span className="block text-xs text-slate-500">Away</span>{away}</span>

                        <input
                          value={ocrAwayScore}
                          disabled={!draft.ready || busy}
                          onChange={(event) =>
                            setOcrAwayScore(event.target.value)
                          }
                          type="number"
                          min="0"
                          max="99"
                          required
                          inputMode="numeric"
                          className="min-w-0 w-full rounded-xl border border-white/10 bg-[#080e15] px-3 py-3 text-center text-2xl font-black"
                        />
                      </label>
                    </div>

                    {supportsPenaltyScores(match) ? <PenaltyInputs home={home} away={away} values={ocrValues} onChange={(field, value) => draft.setOcr(latestOcr!.id, { ...ocrValues, [field]: value })} /> : null}
                    <button
                      disabled={busy || !draft.ready}
                      className="mt-5 w-full rounded-xl theme-primary-button px-5 py-3 font-black disabled:opacity-50"
                    >
                      {isLeagueAdmin
                        ? "Confirm OCR Result & Update Stats"
                        : "Submit OCR Result for Admin Verification"}
                    </button>
                  </form>
                ) : null}

                {latestOcr.resultSubmission ? (
                  <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4 text-sm text-sky-300">
                    OCR result has been submitted. Status:{" "}
                    <strong>
                      {latestOcr.resultSubmission.status.replaceAll("_", " ")}
                    </strong>
                  </div>
                ) : null}

                <details className="rounded-2xl border border-white/10 bg-black/10 p-5">
                  <summary className="cursor-pointer text-sm font-black text-slate-400">
                    OCR Raw Text
                  </summary>

                  <pre className="mt-4 whitespace-pre-wrap text-xs leading-6 text-slate-500">
                    {latestOcr.rawText || "No OCR text extracted."}
                  </pre>
                </details>
              </div>
            ) : null}
          </section>
        ) : null}

        {canSubmit ? (
          <section id="result-entry" className="scroll-mt-24 rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Quick score entry
            </p>

            <h2 className="mt-2 text-2xl font-black">Enter Result Manually</h2>

            <form
              onSubmit={submitManualResult}
              className="mt-6 grid grid-cols-[1fr_auto_1fr] items-end gap-4"
            >
              <label className="grid gap-2 text-sm font-bold">
                {home}

                <input
                  name="homeScore"
                  value={draft.manual.homeScore}
                  onChange={event => draft.setManual("homeScore", event.target.value)}
                  disabled={!draft.ready || busy}
                  inputMode="numeric"
                  type="number"
                  min="0"
                  max="99"
                  required
                  className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                />
              </label>

              <span className="pb-4 font-black text-slate-600">-</span>

              <label className="grid gap-2 text-sm font-bold">
                {away}

                <input
                  name="awayScore"
                  value={draft.manual.awayScore}
                  onChange={event => draft.setManual("awayScore", event.target.value)}
                  disabled={!draft.ready || busy}
                  inputMode="numeric"
                  type="number"
                  min="0"
                  max="99"
                  required
                  className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                />
              </label>

              {supportsPenaltyScores(match) ? <PenaltyInputs home={home} away={away} values={draft.manual} onChange={draft.setManual} /> : null}
              <button
                disabled={busy || !draft.ready}
                className="col-span-3 rounded-xl theme-primary-button border px-5 py-3 font-black disabled:opacity-50"
              >
                {isLeagueAdmin
                  ? "Save Result & Update Stats"
                  : "Submit Manual Result"}
              </button>
            </form>
          </section>
        ) : null}

        {confirmed && isLeagueAdmin ? (
          <details className="rounded-[24px] border border-amber-400/20 bg-amber-400/[0.03] p-6">
            <summary className="cursor-pointer font-semibold">Manage verified result</summary>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
              Admin Result Integrity
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Correct Confirmed Result
            </h2>

            <form onSubmit={correctResult} className="mt-6 grid gap-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                <label className="grid gap-2 text-sm font-bold">
                  {home}

                  <input
                    name="correctedHomeScore"
                    type="number"
                    min="0"
                    max="99"
                    defaultValue={confirmed.homeScore}
                    required
                    className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                  />
                </label>

                <span className="pb-4 font-black text-slate-600">-</span>

                <label className="grid gap-2 text-sm font-bold">
                  {away}

                  <input
                    name="correctedAwayScore"
                    type="number"
                    min="0"
                    max="99"
                    defaultValue={confirmed.awayScore}
                    required
                    className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                  />
                </label>
              </div>

              {supportsPenaltyScores(match) ? <PenaltyInputs home={home} away={away} prefix="corrected" homeScore={confirmed.homePenaltyScore} awayScore={confirmed.awayPenaltyScore} /> : null}
              <label className="fc-field-label">Correction reason <span className="theme-muted">Required · at least 3 characters</span>
              <textarea
                name="correctionReason"
                rows={3}
                minLength={3}
                required
                placeholder="Correction reason"
                className="rounded-xl border border-white/10 bg-[#080e15] p-4"
              />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy}
                  className="rounded-xl theme-primary-button px-5 py-3 font-black disabled:opacity-50"
                >
                  Correct Result
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reverseConfirmedResult()}
                  className="rounded-xl border border-red-400/30 px-5 py-3 font-black text-red-300"
                >
                  Reverse Result Completely
                </button>
              </div>
            </form>
          </details>
        ) : null}

        <section id="result-verification" className="scroll-mt-24 rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-black">Result Verification</h2>

            <Link
              href={"/matches/" + params.matchId + "/dispute"}
              className="rounded-xl border border-amber-400/25 bg-amber-400/[0.04] px-4 py-2 text-sm font-black text-amber-300 transition hover:bg-amber-400/[0.08]"
            >
              Dispute Center
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {submissions.map((submission) => {
              const active = submission.id === confirmedId;

              return (
                <article
                  key={submission.id}
                  className={`rounded-2xl border p-5 ${
                    active
                      ? "border-emerald-400/30 bg-emerald-400/[0.03]"
                      : "border-white/10 bg-black/10"
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-2xl font-black">
                          {submission.homeScore}
                          {" - "}
                          {submission.awayScore}
                        </p>

                        <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black text-slate-400">
                          {submission.status.replaceAll("_", " ")}
                        </span>

                        {submission.source ? (
                          <span className="rounded-full border border-sky-400/20 px-3 py-1 text-[10px] font-black text-sky-300">
                            {submission.source}
                          </span>
                        ) : null}

                        {active ? (
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-300">
                            ACTIVE RESULT
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        Submitted by{" "}
                        {submission.submittedBy.player?.identity?.inGameName ||
                          submission.submittedBy.fullName}
                      </p>

                      {submission.rejectionReason ? (
                        <p className="mt-2 text-sm text-red-300">
                          {submission.rejectionReason}
                        </p>
                      ) : null}
                    </div>

                    {isLeagueAdmin &&
                    submission.status === "PENDING_VERIFICATION" ? (
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => void confirmResult(submission.id)}
                          className="rounded-xl theme-primary-button px-4 py-2 text-sm font-black"
                        >
                          Confirm
                        </button>

                        <button
                          disabled={busy}
                          onClick={() => void rejectResult(submission.id)}
                          className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-black text-red-300"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}

            {submissions.length === 0 ? (
              <FcEmptyState title="No result submissions" description="Submitted results will appear here for verification." icon="fixtures" />
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
