'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import type {
  FormEvent,
} from 'react';

import {
  authenticatedRequest,
} from '@/lib/auth-client';


interface ResultSubmission {
  id: string;
  homeScore: number;
  awayScore: number;
  status: string;
}


interface MatchResultsResponse {
  success: true;

  data: {
    isLeagueAdmin: boolean;
    canVerifyResult: boolean;
    canSubmitResult: boolean;
    isParticipant: boolean;

    confirmedResultSubmissionId:
      string | null;

    submissions:
      ResultSubmission[];
  };

  error: null;
}


interface InlineResultPanelProps {
  matchId: string;
  homeName: string;
  awayName: string;
  completed: boolean;
  matchHref: string;

  onSaved?: () =>
    Promise<void> | void;
}


function validScore(
  value: string,
) {
  if (
    value.trim() ===
    ''
  ) {
    return false;
  }

  const parsed =
    Number(value);

  return (
    Number.isInteger(
      parsed,
    ) &&
    parsed >= 0
  );
}


export function InlineResultPanel({
  matchId,
  homeName,
  awayName,
  completed,
  matchHref,
  onSaved,
}: InlineResultPanelProps) {
  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    homeScore,
    setHomeScore,
  ] =
    useState('');

  const [
    awayScore,
    setAwayScore,
  ] =
    useState('');

  const [
    isLeagueAdmin,
    setIsLeagueAdmin,
  ] =
    useState(false);

  const [
    canSubmitResult,
    setCanSubmitResult,
  ] =
    useState(false);

  const [
    confirmedResult,
    setConfirmedResult,
  ] =
    useState<ResultSubmission | null>(
      null,
    );

  const [
    pendingResult,
    setPendingResult,
  ] =
    useState<ResultSubmission | null>(
      null,
    );


  const loadResults =
    useCallback(
      async (
        silent = false,
      ) => {
        if (
          !silent
        ) {
          setLoading(true);
        }

        setError('');

        try {
          const response =
            await authenticatedRequest<MatchResultsResponse>(
              `/matches/${matchId}/results`,
            );

          const confirmed =
            response.data.submissions.find(
              (
                submission,
              ) =>
                submission.id ===
                  response.data
                    .confirmedResultSubmissionId ||
                submission.status ===
                  'CONFIRMED',
            ) ??
            null;

          const pending =
            response.data.submissions.find(
              (
                submission,
              ) =>
                submission.status ===
                'PENDING_VERIFICATION',
            ) ??
            null;

          setIsLeagueAdmin(
            response.data
              .canVerifyResult ||
            response.data
              .isLeagueAdmin,
          );

          setCanSubmitResult(
            response.data
              .canSubmitResult,
          );

          setConfirmedResult(
            confirmed,
          );

          setPendingResult(
            pending,
          );
        } catch (
          err
        ) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load match result.',
          );
        } finally {
          setLoading(false);
        }
      },
      [
        matchId,
      ],
    );


  useEffect(() => {
    const initialLoad =
      window.setTimeout(
        () => {
          void loadResults();
        },
        0,
      );

    const refresh =
      window.setInterval(
        () => {
          void loadResults(
            true,
          );
        },
        15_000,
      );

    const onFocus =
      () => {
        void loadResults(
          true,
        );
      };

    window.addEventListener(
      'focus',
      onFocus,
    );

    return () => {
      window.clearTimeout(
        initialLoad,
      );

      window.clearInterval(
        refresh,
      );

      window.removeEventListener(
        'focus',
        onFocus,
      );
    };
  }, [
    loadResults,
  ]);


  async function submitResult(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !validScore(
        homeScore,
      ) ||
      !validScore(
        awayScore,
      )
    ) {
      setError(
        'Enter valid whole-number scores for both sides.',
      );

      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;

            submission: {
              id: string;
            };
          };

          error: null;
        }>(
          `/matches/${matchId}/results`,
          {
            method:
              'POST',

            body:
              JSON.stringify({
                homeScore:
                  Number(
                    homeScore,
                  ),

                awayScore:
                  Number(
                    awayScore,
                  ),
              }),
          },
        );

      if (
        isLeagueAdmin
      ) {
        const confirmed =
          await authenticatedRequest<{
            success: true;

            data: {
              message:
                string;
            };

            error: null;
          }>(
            `/results/${response.data.submission.id}/confirm`,
            {
              method:
                'POST',
            },
          );

        setMessage(
          confirmed.data.message,
        );

        setHomeScore('');
        setAwayScore('');

        await loadResults();

        try {
          await onSaved?.();
        } catch {
          // The result is already
          // safely stored. A list
          // refresh may be retried.
        }
      } else {
        setMessage(
          response.data.message,
        );

        setHomeScore('');
        setAwayScore('');

        await loadResults();
      }
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit result.',
      );
    } finally {
      setBusy(false);
    }
  }


  if (
    loading
  ) {
    return (
      <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#0E141B] p-4 text-sm text-[#A7B0BE]">
        Loading result...
      </div>
    );
  }


  return (
    <div className="mt-4 rounded-xl border border-[#284154] bg-[#0E141B] p-4">
      {confirmedResult ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
            Confirmed Result
          </p>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-xs font-semibold text-[#A7B0BE]">
                {
                  homeName
                }
              </p>

              <p className="mt-1 text-2xl font-black text-[#F8FAFC]">
                {
                  confirmedResult.homeScore
                }
              </p>
            </div>

            <span className="text-xs font-black text-[#6F7B8A]">
              -
            </span>

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#A7B0BE]">
                {
                  awayName
                }
              </p>

              <p className="mt-1 text-2xl font-black text-[#F8FAFC]">
                {
                  confirmedResult.awayScore
                }
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Link
              href={
                `${matchHref}#result-update`
              }
              className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[#284154] bg-[#14212D] px-3.5 text-xs font-semibold text-[#F8FAFC] transition hover:border-[#38BDF8]/35"
            >
              Match Center / Correction
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-[#F8FAFC]">
                Update Result
              </p>

              <p className="mt-1 text-xs text-[#A7B0BE]">
                Enter the final score here. No separate page required.
              </p>
            </div>

            <Link
              href={
                `${matchHref}#result-update`
              }
              className="text-xs font-semibold text-[#38BDF8]"
            >
              OCR / Match Center
            </Link>
          </div>

          {pendingResult ? (
            <div className="mt-4 rounded-[10px] border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-200">
              Shared pending result:{' '}
              <span className="font-black">
                {
                  pendingResult.homeScore
                } - {
                  pendingResult.awayScore
                }
              </span>
              . This is the same match for both players, so a duplicate result cannot be submitted.
              {isLeagueAdmin
                ? ' Open Match Center to verify or reject it.'
                : ' Waiting for admin verification.'}
            </div>
          ) : null}

          {!canSubmitResult ? (
            <div className="mt-4 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs leading-5 text-[#A7B0BE]">
              Only players in this fixture or an authorized match admin can submit a result.
            </div>
          ) : null}

          {canSubmitResult &&
          !pendingResult ? (
          <form
            className="mt-4"
            onSubmit={
              submitResult
            }
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <label className="grid min-w-0 gap-2">
                <span className="truncate text-xs font-semibold text-[#A7B0BE]">
                  {
                    homeName
                  }
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={
                    homeScore
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setHomeScore(
                        event.target.value,
                      )
                  }
                  disabled={
                    busy
                  }
                  required
                  aria-label={
                    `${homeName} score`
                  }
                  className="min-h-11 w-full rounded-[10px] border border-[#253140] bg-[#151C26] px-3 text-center text-lg font-black outline-none focus:border-[#38BDF8]"
                />
              </label>

              <span className="pb-3 text-xs font-black text-[#6F7B8A]">
                VS
              </span>

              <label className="grid min-w-0 gap-2">
                <span className="truncate text-xs font-semibold text-[#A7B0BE]">
                  {
                    awayName
                  }
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={
                    awayScore
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setAwayScore(
                        event.target.value,
                      )
                  }
                  disabled={
                    busy
                  }
                  required
                  aria-label={
                    `${awayName} score`
                  }
                  className="min-h-11 w-full rounded-[10px] border border-[#253140] bg-[#151C26] px-3 text-center text-lg font-black outline-none focus:border-[#38BDF8]"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={
                busy
              }
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#38BDF8] px-4 text-sm font-black text-[#071018] transition hover:bg-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? 'Updating...'
                : isLeagueAdmin
                  ? 'Save & Confirm Result'
                  : 'Submit Result'}
            </button>
          </form>
          ) : null}
        </>
      )}

      {message ? (
        <div className="mt-3 rounded-[10px] border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5 text-xs text-emerald-200">
          {
            message
          }
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-[10px] border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-xs text-red-200">
          {
            error
          }
        </div>
      ) : null}

      {completed &&
      !confirmedResult &&
      !error ? (
        <p className="mt-3 text-xs text-[#A7B0BE]">
          This match is marked completed. Open Match Center if the confirmed score is not visible here yet.
        </p>
      ) : null}
    </div>
  );
}
