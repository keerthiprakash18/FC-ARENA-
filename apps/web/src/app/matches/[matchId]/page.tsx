'use client';

import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useState,
} from 'react';
import type {
  FormEvent,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  authenticatedRequest,
  authenticatedUpload,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

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

  tournament: {
    id: string;
    name: string;
    mode: string;
    format: string;
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
  status:
    | 'QUEUED'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED';

  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;

  rawText: string | null;
  ocrConfidence: number | null;

  detectedHomeName:
    string | null;

  detectedAwayName:
    string | null;

  detectedHomeScore:
    number | null;

  detectedAwayScore:
    number | null;

  homeNameConfidence:
    number | null;

  awayNameConfidence:
    number | null;

  scoreConfidence:
    number | null;

  failureReason:
    string | null;

  processedAt:
    string | null;

  createdAt: string;

  homeMatchedUser:
    MatchedOcrUser | null;

  awayMatchedUser:
    MatchedOcrUser | null;

  resultSubmission: {
    id: string;
    status: string;
  } | null;
}

function entryName(
  entry: MatchEntry | null,
  source: string | null,
) {
  if (
    entry?.entryName
  ) {
    return entry.entryName;
  }

  if (entry) {
    return entry.members
      .map(
        (member) =>
          member.inGameName ||
          member.fullName,
      )
      .join(' + ');
  }

  if (source) {
    return `Winner of ${source}`;
  }

  return 'TBD';
}

function percentage(
  confidence:
    number | null,
) {
  if (
    confidence === null
  ) {
    return '—';
  }

  return `${Math.round(
    confidence * 100,
  )}%`;
}

function confidenceLabel(
  confidence:
    number | null,
) {
  if (
    confidence === null
  ) {
    return 'Unknown';
  }

  if (
    confidence >= 0.85
  ) {
    return 'High Confidence';
  }

  if (
    confidence >= 0.5
  ) {
    return 'Needs Review';
  }

  return 'Manual Check Required';
}

function confidenceClass(
  confidence:
    number | null,
) {
  if (
    confidence === null
  ) {
    return 'border-white/10 bg-white/5 text-slate-400';
  }

  if (
    confidence >= 0.85
  ) {
    return 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300';
  }

  if (
    confidence >= 0.5
  ) {
    return 'border-amber-400/20 bg-amber-400/5 text-amber-300';
  }

  return 'border-red-400/20 bg-red-400/5 text-red-300';
}

export default function MatchCenterPage() {
  const params =
    useParams<{
      matchId: string;
    }>();

  const router =
    useRouter();

  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  const [match, setMatch] =
    useState<MatchCenter | null>(
      null,
    );

  const [
    submissions,
    setSubmissions,
  ] =
    useState<ResultSubmission[]>(
      [],
    );

  const [
    confirmedId,
    setConfirmedId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    isLeagueAdmin,
    setIsLeagueAdmin,
  ] =
    useState(false);

  const [
    latestOcr,
    setLatestOcr,
  ] =
    useState<OcrExtraction | null>(
      null,
    );

  const [
    uploadProgress,
    setUploadProgress,
  ] =
    useState(0);

  const [
    ocrHomeScore,
    setOcrHomeScore,
  ] =
    useState('');

  const [
    ocrAwayScore,
    setOcrAwayScore,
  ] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  async function loadMatch() {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          match:
            MatchCenter;
        };

        error: null;
      }>(
        `/matches/${params.matchId}`,
      );

    setMatch(
      response.data.match,
    );
  }

  async function loadResults() {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          isLeagueAdmin:
            boolean;

          confirmedResultSubmissionId:
            string | null;

          submissions:
            ResultSubmission[];
        };

        error: null;
      }>(
        `/matches/${params.matchId}/results`,
      );

    setSubmissions(
      response.data.submissions,
    );

    setConfirmedId(
      response.data
        .confirmedResultSubmissionId,
    );

    setIsLeagueAdmin(
      response.data
        .isLeagueAdmin,
    );
  }

  async function loadLatestOcr() {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          extraction:
            OcrExtraction | null;
        };

        error: null;
      }>(
        `/matches/${params.matchId}/ocr/latest`,
      );

    setLatestOcr(
      response.data.extraction,
    );
  }

  async function refreshMatchCenter() {
    await Promise.all([
      loadMatch(),
      loadResults(),
      loadLatestOcr(),
    ]);
  }

  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        await refreshMatchCenter();
      } catch {
        router.replace(
          '/dashboard',
        );
      }
    }

    void load();
  }, [
    params.matchId,
    router,
  ]);

  useEffect(() => {
    const status =
      latestOcr?.status;

    if (
      status !== 'QUEUED' &&
      status !== 'PROCESSING'
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          void (async () => {
            try {
              const response =
                await authenticatedRequest<{
                  success: true;

                  data: {
                    extraction:
                      OcrExtraction | null;
                  };

                  error: null;
                }>(
                  `/matches/${params.matchId}/ocr/latest`,
                );

              setLatestOcr(
                response.data
                  .extraction,
              );
            } catch {
              // Polling may retry
              // automatically on
              // the next interval.
            }
          })();
        },
        2000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    latestOcr?.status,
    params.matchId,
  ]);

  useEffect(() => {
    if (
      latestOcr?.status !==
      'COMPLETED'
    ) {
      return;
    }

    const scoreConfidence =
      latestOcr.scoreConfidence ??
      0;

    /*
     * Master rule:
     * < 0.50 must not be
     * trusted automatically.
     */
    if (
      scoreConfidence < 0.5
    ) {
      setOcrHomeScore('');
      setOcrAwayScore('');

      return;
    }

    setOcrHomeScore(
      latestOcr
        .detectedHomeScore !==
        null
        ? String(
            latestOcr
              .detectedHomeScore,
          )
        : '',
    );

    setOcrAwayScore(
      latestOcr
        .detectedAwayScore !==
        null
        ? String(
            latestOcr
              .detectedAwayScore,
          )
        : '',
    );
  }, [
    latestOcr?.id,
    latestOcr?.status,
    latestOcr?.scoreConfidence,
    latestOcr?.detectedHomeScore,
    latestOcr?.detectedAwayScore,
  ]);

  async function submitManualResult(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const data =
      new FormData(
        event.currentTarget,
      );

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/matches/${params.matchId}/results`,
          {
            method: 'POST',

            body:
              JSON.stringify({
                homeScore:
                  Number(
                    data.get(
                      'homeScore',
                    ),
                  ),

                awayScore:
                  Number(
                    data.get(
                      'awayScore',
                    ),
                  ),
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      event.currentTarget.reset();

      await loadResults();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit result.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadScreenshot(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget,
      );

    const screenshot =
      form.get(
        'screenshot',
      );

    if (
      !(screenshot instanceof File) ||
      screenshot.size === 0
    ) {
      setError(
        'Select a result screenshot.',
      );

      return;
    }

    const allowed =
      new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
      ]);

    if (
      !allowed.has(
        screenshot.type,
      )
    ) {
      setError(
        'Only JPG, PNG and WEBP screenshots are allowed.',
      );

      return;
    }

    if (
      screenshot.size >
      10 * 1024 * 1024
    ) {
      setError(
        'Screenshot must be 10 MB or smaller.',
      );

      return;
    }

    const uploadBody =
      new FormData();

    uploadBody.append(
      'screenshot',
      screenshot,
    );

    setBusy(true);
    setMessage('');
    setError('');
    setUploadProgress(0);

    try {
      const response =
        await authenticatedUpload<{
          success: true;

          data: {
            message: string;

            extraction: {
              id: string;
              status: string;
            };
          };

          error: null;
        }>(
          `/matches/${params.matchId}/ocr`,
          uploadBody,
          (progress) =>
            setUploadProgress(
              progress,
            ),
        );

      setUploadProgress(
        100,
      );

      setMessage(
        response.data.message,
      );

      event.currentTarget.reset();

      await loadLatestOcr();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Screenshot upload failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitOcrResult(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!latestOcr) {
      return;
    }

    if (
      ocrHomeScore === '' ||
      ocrAwayScore === ''
    ) {
      setError(
        'Enter both scores before submitting.',
      );

      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/ocr/${latestOcr.id}/submit-result`,
          {
            method: 'POST',

            body:
              JSON.stringify({
                homeScore:
                  Number(
                    ocrHomeScore,
                  ),

                awayScore:
                  Number(
                    ocrAwayScore,
                  ),
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await Promise.all([
        loadLatestOcr(),
        loadResults(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit OCR result.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmResult(
    submissionId: string,
  ) {
    if (
      !window.confirm(
        'Confirm this result? Statistics and standings will be updated.',
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/results/${submissionId}/confirm`,
          {
            method: 'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await refreshMatchCenter();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to confirm result.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function rejectResult(
    submissionId: string,
  ) {
    const reason =
      window.prompt(
        'Reason for rejection (optional):',
      );

    if (
      reason === null
    ) {
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/results/${submissionId}/reject`,
          {
            method: 'POST',

            body:
              JSON.stringify({
                reason:
                  reason ||
                  undefined,
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await loadResults();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reject result.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function correctResult(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const data =
      new FormData(
        event.currentTarget,
      );

    const homeScore =
      Number(
        data.get(
          'correctedHomeScore',
        ),
      );

    const awayScore =
      Number(
        data.get(
          'correctedAwayScore',
        ),
      );

    const reason =
      String(
        data.get(
          'correctionReason',
        ) ?? '',
      ).trim();

    if (
      reason.length < 3
    ) {
      setError(
        'Correction reason must contain at least 3 characters.',
      );

      return;
    }

    if (
      !window.confirm(
        `Correct result to ${homeScore}-${awayScore}?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/matches/${params.matchId}/results/correct`,
          {
            method: 'POST',

            body:
              JSON.stringify({
                homeScore,
                awayScore,
                reason,
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await refreshMatchCenter();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to correct result.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function reverseConfirmedResult() {
    const reason =
      window.prompt(
        'Why are you reversing this confirmed result?',
      );

    if (
      reason === null
    ) {
      return;
    }

    if (
      reason.trim().length <
      3
    ) {
      setError(
        'Reversal reason must contain at least 3 characters.',
      );

      return;
    }

    if (
      !window.confirm(
        'Reverse this confirmed result and remove its statistics?',
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/matches/${params.matchId}/results/reverse`,
          {
            method: 'POST',

            body:
              JSON.stringify({
                reason:
                  reason.trim(),
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await refreshMatchCenter();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reverse result.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    !user ||
    !match
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Match Center...
      </div>
    );
  }

  const home =
    entryName(
      match.fixture.home,
      match.fixture.homeSource,
    );

  const away =
    entryName(
      match.fixture.away,
      match.fixture.awaySource,
    );

  const confirmed =
    submissions.find(
      (submission) =>
        submission.id ===
        confirmedId,
    );

  const canSubmit =
    !confirmedId &&
    (
      match.status ===
        'SCHEDULED' ||
      match.status ===
        'LIVE'
    );

  const ocrProcessing =
    latestOcr?.status ===
      'QUEUED' ||
    latestOcr?.status ===
      'PROCESSING';

  const canSubmitOcr =
    latestOcr?.status ===
      'COMPLETED' &&
    !latestOcr
      .resultSubmission &&
    !confirmedId;

  return (
    <AppShell
      playerName={
        user.player?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
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

        <section className="rounded-[30px] border border-white/10 bg-[#0a1018] p-6 md:p-10">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
                Match Center
              </p>

              <h1 className="mt-3 text-3xl font-black md:text-5xl">
                {match.matchCode}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                {match.tournament.name}
              </p>
            </div>

            <span className="h-fit rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300">
              {match.status.replaceAll(
                '_',
                ' ',
              )}
            </span>
          </div>

          <div className="mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-5">
            <div className="text-center">
              <p className="text-xl font-black md:text-3xl">
                {home}
              </p>

              {confirmed ? (
                <p className="mt-5 text-6xl font-black text-sky-400">
                  {confirmed.homeScore}
                </p>
              ) : null}
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-3 font-black text-slate-500">
              {confirmed
                ? 'FT'
                : 'VS'}
            </div>

            <div className="text-center">
              <p className="text-xl font-black md:text-3xl">
                {away}
              </p>

              {confirmed ? (
                <p className="mt-5 text-6xl font-black text-sky-400">
                  {confirmed.awayScore}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">
              Round
            </p>

            <p className="mt-2 font-black">
              {match.fixture.roundName}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">
              Matchday
            </p>

            <p className="mt-2 font-black">
              {match.fixture.matchday ??
                '—'}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">
              Date & Time
            </p>

            <p className="mt-2 font-black">
              {match.fixture.scheduledAt
                ? new Date(
                    match.fixture.scheduledAt,
                  ).toLocaleString()
                : 'Not scheduled'}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">
              Venue
            </p>

            <p className="mt-2 font-black">
              {match.fixture.venue ||
                '—'}
            </p>
          </article>
        </section>

        {canSubmit ? (
          <section className="rounded-[26px] border border-sky-400/20 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
              AI Result Scanner
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Upload Match Screenshot
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Upload the FC Mobile result screenshot. FC ARENA will scan the image, detect the score and compare detected player names only against this Match.
            </p>

            <form
              onSubmit={
                uploadScreenshot
              }
              className="mt-6 grid gap-4"
            >
              <input
                name="screenshot"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                className="rounded-xl border border-dashed border-white/15 bg-black/10 p-4 text-sm"
              />

              {uploadProgress >
              0 ? (
                <div>
                  <div className="mb-2 flex justify-between text-xs text-slate-500">
                    <span>
                      Upload
                    </span>

                    <span>
                      {uploadProgress}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full bg-sky-400 transition-all"
                      style={{
                        width:
                          `${uploadProgress}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              <button
                disabled={
                  busy ||
                  ocrProcessing
                }
                className="rounded-xl bg-sky-400 px-5 py-3 font-black text-[#041019] disabled:opacity-50"
              >
                {ocrProcessing
                  ? 'Processing Match Result...'
                  : 'Upload & Scan Screenshot'}
              </button>
            </form>
          </section>
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
                {latestOcr.status.replaceAll(
                  '_',
                  ' ',
                )}
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

            {latestOcr.status ===
            'FAILED' ? (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-red-300">
                <p className="font-black">
                  OCR processing failed
                </p>

                <p className="mt-2 text-sm">
                  {latestOcr.failureReason ||
                    'Unknown OCR error.'}
                </p>
              </div>
            ) : null}

            {latestOcr.status ===
            'COMPLETED' ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  <article
                    className={`rounded-2xl border p-5 ${confidenceClass(
                      latestOcr.homeNameConfidence,
                    )}`}
                  >
                    <p className="text-xs font-black uppercase">
                      Home Name
                    </p>

                    <p className="mt-3 font-mono text-sm">
                      {latestOcr.detectedHomeName ||
                        'Not detected'}
                    </p>

                    <p className="mt-3 text-lg font-black">
                      {latestOcr.homeMatchedUser
                        ?.player
                        ?.identity
                        ?.inGameName ||
                        latestOcr.homeMatchedUser
                          ?.fullName ||
                        'Manual verification'}
                    </p>

                    <p className="mt-2 text-xs">
                      {confidenceLabel(
                        latestOcr.homeNameConfidence,
                      )}{' '}
                      •{' '}
                      {percentage(
                        latestOcr.homeNameConfidence,
                      )}
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
                      {latestOcr.detectedHomeScore ??
                        '?'}
                      {' - '}
                      {latestOcr.detectedAwayScore ??
                        '?'}
                    </p>

                    <p className="mt-4 text-center text-xs">
                      {confidenceLabel(
                        latestOcr.scoreConfidence,
                      )}{' '}
                      •{' '}
                      {percentage(
                        latestOcr.scoreConfidence,
                      )}
                    </p>
                  </article>

                  <article
                    className={`rounded-2xl border p-5 ${confidenceClass(
                      latestOcr.awayNameConfidence,
                    )}`}
                  >
                    <p className="text-xs font-black uppercase">
                      Away Name
                    </p>

                    <p className="mt-3 font-mono text-sm">
                      {latestOcr.detectedAwayName ||
                        'Not detected'}
                    </p>

                    <p className="mt-3 text-lg font-black">
                      {latestOcr.awayMatchedUser
                        ?.player
                        ?.identity
                        ?.inGameName ||
                        latestOcr.awayMatchedUser
                          ?.fullName ||
                        'Manual verification'}
                    </p>

                    <p className="mt-2 text-xs">
                      {confidenceLabel(
                        latestOcr.awayNameConfidence,
                      )}{' '}
                      •{' '}
                      {percentage(
                        latestOcr.awayNameConfidence,
                      )}
                    </p>
                  </article>
                </div>

                {(latestOcr.scoreConfidence ??
                  0) <
                0.5 ? (
                  <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
                    Score confidence is below 50%. FC ARENA did not trust the detected score automatically. Enter the score manually before submission.
                  </div>
                ) : (latestOcr.scoreConfidence ??
                    0) <
                  0.85 ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-300">
                    OCR confidence is moderate. Verify the score carefully before submitting.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
                    OCR confidence is high. Human confirmation is still required.
                  </div>
                )}

                {canSubmitOcr ? (
                  <form
                    onSubmit={
                      submitOcrResult
                    }
                    className="rounded-2xl border border-white/10 bg-black/10 p-5"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Verify Detected Result
                    </p>

                    <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                      <label className="grid gap-2 text-sm font-bold">
                        {home}

                        <input
                          value={
                            ocrHomeScore
                          }
                          onChange={(
                            event,
                          ) =>
                            setOcrHomeScore(
                              event.target
                                .value,
                            )
                          }
                          type="number"
                          min="0"
                          max="99"
                          required
                          className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                        />
                      </label>

                      <span className="pb-4 font-black text-slate-600">
                        -
                      </span>

                      <label className="grid gap-2 text-sm font-bold">
                        {away}

                        <input
                          value={
                            ocrAwayScore
                          }
                          onChange={(
                            event,
                          ) =>
                            setOcrAwayScore(
                              event.target
                                .value,
                            )
                          }
                          type="number"
                          min="0"
                          max="99"
                          required
                          className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                        />
                      </label>
                    </div>

                    <button
                      disabled={busy}
                      className="mt-5 w-full rounded-xl bg-emerald-400 px-5 py-3 font-black text-black disabled:opacity-50"
                    >
                      Submit OCR Result for Admin Verification
                    </button>
                  </form>
                ) : null}

                {latestOcr
                  .resultSubmission ? (
                  <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4 text-sm text-sky-300">
                    OCR result has been submitted. Status:{' '}
                    <strong>
                      {latestOcr.resultSubmission.status.replaceAll(
                        '_',
                        ' ',
                      )}
                    </strong>
                  </div>
                ) : null}

                <details className="rounded-2xl border border-white/10 bg-black/10 p-5">
                  <summary className="cursor-pointer text-sm font-black text-slate-400">
                    OCR Raw Text
                  </summary>

                  <pre className="mt-4 whitespace-pre-wrap text-xs leading-6 text-slate-500">
                    {latestOcr.rawText ||
                      'No OCR text extracted.'}
                  </pre>
                </details>
              </div>
            ) : null}
          </section>
        ) : null}

        {canSubmit ? (
          <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Manual Fallback
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Enter Result Manually
            </h2>

            <form
              onSubmit={
                submitManualResult
              }
              className="mt-6 grid grid-cols-[1fr_auto_1fr] items-end gap-4"
            >
              <label className="grid gap-2 text-sm font-bold">
                {home}

                <input
                  name="homeScore"
                  type="number"
                  min="0"
                  max="99"
                  required
                  className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                />
              </label>

              <span className="pb-4 font-black text-slate-600">
                -
              </span>

              <label className="grid gap-2 text-sm font-bold">
                {away}

                <input
                  name="awayScore"
                  type="number"
                  min="0"
                  max="99"
                  required
                  className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                />
              </label>

              <button
                disabled={busy}
                className="col-span-3 rounded-xl border border-white/10 bg-white px-5 py-3 font-black text-black disabled:opacity-50"
              >
                Submit Manual Result
              </button>
            </form>
          </section>
        ) : null}

        {confirmed &&
        isLeagueAdmin ? (
          <section className="rounded-[24px] border border-amber-400/20 bg-amber-400/[0.03] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
              Admin Result Integrity
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Correct Confirmed Result
            </h2>

            <form
              onSubmit={
                correctResult
              }
              className="mt-6 grid gap-4"
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                <label className="grid gap-2 text-sm font-bold">
                  {home}

                  <input
                    name="correctedHomeScore"
                    type="number"
                    min="0"
                    max="99"
                    defaultValue={
                      confirmed.homeScore
                    }
                    required
                    className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                  />
                </label>

                <span className="pb-4 font-black text-slate-600">
                  -
                </span>

                <label className="grid gap-2 text-sm font-bold">
                  {away}

                  <input
                    name="correctedAwayScore"
                    type="number"
                    min="0"
                    max="99"
                    defaultValue={
                      confirmed.awayScore
                    }
                    required
                    className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-center text-2xl font-black"
                  />
                </label>
              </div>

              <textarea
                name="correctionReason"
                rows={3}
                minLength={3}
                required
                placeholder="Correction reason"
                className="rounded-xl border border-white/10 bg-[#080e15] p-4"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy}
                  className="rounded-xl bg-amber-300 px-5 py-3 font-black text-black disabled:opacity-50"
                >
                  Correct Result
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void reverseConfirmedResult()
                  }
                  className="rounded-xl border border-red-400/30 px-5 py-3 font-black text-red-300"
                >
                  Reverse Result Completely
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
          <h2 className="text-2xl font-black">
            Result Verification
          </h2>

          <div className="mt-5 space-y-3">
            {submissions.map(
              (submission) => {
                const active =
                  submission.id ===
                  confirmedId;

                return (
                  <article
                    key={
                      submission.id
                    }
                    className={`rounded-2xl border p-5 ${
                      active
                        ? 'border-emerald-400/30 bg-emerald-400/[0.03]'
                        : 'border-white/10 bg-black/10'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-2xl font-black">
                            {submission.homeScore}
                            {' - '}
                            {submission.awayScore}
                          </p>

                          <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black text-slate-400">
                            {submission.status.replaceAll(
                              '_',
                              ' ',
                            )}
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
                          Submitted by{' '}
                          {submission.submittedBy
                            .player?.identity
                            ?.inGameName ||
                            submission.submittedBy
                              .fullName}
                        </p>

                        {submission.rejectionReason ? (
                          <p className="mt-2 text-sm text-red-300">
                            {submission.rejectionReason}
                          </p>
                        ) : null}
                      </div>

                      {isLeagueAdmin &&
                      submission.status ===
                        'PENDING_VERIFICATION' ? (
                        <div className="flex gap-2">
                          <button
                            disabled={busy}
                            onClick={() =>
                              void confirmResult(
                                submission.id,
                              )
                            }
                            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-black"
                          >
                            Confirm
                          </button>

                          <button
                            disabled={busy}
                            onClick={() =>
                              void rejectResult(
                                submission.id,
                              )
                            }
                            className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-black text-red-300"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              },
            )}

            {submissions.length ===
            0 ? (
              <p className="py-8 text-center text-sm text-slate-600">
                No result submissions yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}