'use client';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  TournamentWizardShell,
  type TournamentWizardStep,
} from '@/components/tournaments/tournament-wizard-shell';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';


export default function ReviewPage() {
  const {
    tournamentId,
  } =
    useParams<{
      tournamentId:
        string;
    }>();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    steps,
    setSteps,
  ] =
    useState<TournamentWizardStep[]>(
      [],
    );

  const [
    review,
    setReview,
  ] =
    useState<any>(
      null,
    );

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


  useEffect(() => {
    async function load() {
      try {
        const [
          current,
          wizard,
          response,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/wizard`,
            ),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/wizard/review`,
            ),
          ]);

        setUser(
          current,
        );

        setSteps(
          wizard.data.steps,
        );

        setReview(
          response.data,
        );
      } catch (
        err
      ) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load review.',
        );
      }
    }

    void load();
  }, [
    tournamentId,
  ]);


  async function publish() {
    if (
      !window.confirm(
        'Publish this Tournament? It will become active.',
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/wizard/publish`,
        {
          method:
            'POST',
        },
      );

      router.push(
        `/tournaments/${tournamentId}`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to publish Tournament.',
      );
    } finally {
      setBusy(false);
    }
  }


  if (
    !user ||
    !review ||
    steps.length ===
      0
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Review...
      </div>
    );
  }


  const tournament =
    review.tournament;


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >

      <TournamentWizardShell
        tournamentId={
          tournamentId
        }
        currentStep="REVIEW"
        steps={
          steps
        }
        title="Review Tournament"
        description="Verify the final Tournament structure before publishing."
      >

        {error ? (
          <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-red-300">
            {error}
          </div>
        ) : null}


        <section className="rounded-[24px] border border-sky-400/20 bg-sky-400/[0.03] p-6">

          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            {
              tournament.code
            }
          </p>

          <h2 className="mt-2 text-3xl font-black">
            {
              tournament.name
            }
          </h2>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-xl bg-black/20 p-4">
              <p className="text-xs text-slate-600">
                Teams
              </p>
              <p className="mt-1 text-2xl font-black">
                {
                  review.approvedEntries
                }
              </p>
            </div>

            <div className="rounded-xl bg-black/20 p-4">
              <p className="text-xs text-slate-600">
                Groups
              </p>
              <p className="mt-1 text-2xl font-black">
                {
                  review.groups.length
                }
              </p>
            </div>

            <div className="rounded-xl bg-black/20 p-4">
              <p className="text-xs text-slate-600">
                Fixtures
              </p>
              <p className="mt-1 text-2xl font-black">
                {
                  review.fixtureCount
                }
              </p>
            </div>

            <div className="rounded-xl bg-black/20 p-4">
              <p className="text-xs text-slate-600">
                Format
              </p>
              <p className="mt-1 text-sm font-black">
                {
                  tournament
                    .competitionFormat
                    .replaceAll(
                      '_',
                      ' ',
                    )
                }
              </p>
            </div>

          </div>

        </section>


        {review.groups.length >
        0 ? (
          <section className="mt-6">

            <h3 className="text-xl font-black">
              Groups
            </h3>

            <div className="mt-3 grid gap-3 md:grid-cols-2">

              {review.groups.map(
                (
                  group: any,
                ) => (
                  <div
                    key={
                      group.id
                    }
                    className="rounded-xl border border-white/10 p-4"
                  >
                    <p className="font-black">
                      {
                        group.name
                      }
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        group.teams
                      } Teams
                    </p>
                  </div>
                ),
              )}

            </div>

          </section>
        ) : null}


        {tournament.qualifiersPerGroup ? (
          <section className="mt-6 rounded-xl border border-white/10 p-5">

            <p className="font-black">
              Qualification
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Top {
                tournament.qualifiersPerGroup
              } from each group
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Pairing: {
                tournament
                  .playoffPairingMethod
                  .replaceAll(
                    '_',
                    ' ',
                  )
              }
            </p>

          </section>
        ) : null}


        <div className="mt-8 flex justify-between border-t border-white/10 pt-5">

          <button
            type="button"
            onClick={() =>
              router.back()
            }
            className="rounded-xl border border-white/10 px-5 py-3 font-black text-slate-400"
          >
            ← Back
          </button>

          <button
            type="button"
            disabled={
              busy
            }
            onClick={() =>
              void publish()
            }
            className="rounded-xl bg-emerald-400 px-7 py-3 font-black text-[#041019] disabled:opacity-40"
          >
            {busy
              ? 'Publishing...'
              : 'Publish Tournament'}
          </button>

        </div>

      </TournamentWizardShell>

    </AppShell>
  );
}