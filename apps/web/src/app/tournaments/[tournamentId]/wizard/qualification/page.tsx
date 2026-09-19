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


export default function QualificationPage() {
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
    qualifiers,
    setQualifiers,
  ] =
    useState(
      2,
    );

  const [
    method,
    setMethod,
  ] =
    useState(
      'CROSS_GROUP',
    );

  const [
    error,
    setError,
  ] =
    useState('');


  useEffect(() => {
    async function load() {
      const [
        current,
        wizard,
      ] =
        await Promise.all([
          getCurrentUser(),

          authenticatedRequest<any>(
            `/tournaments/${tournamentId}/wizard`,
          ),
        ]);

      setUser(
        current,
      );

      setSteps(
        wizard.data.steps,
      );
    }

    void load();
  }, [
    tournamentId,
  ]);


  async function save() {
    setError('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/wizard/qualification`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              qualifiersPerGroup:
                qualifiers,

              playoffPairingMethod:
                method,
            }),
        },
      );

      router.push(
        `/tournaments/${tournamentId}/wizard/review`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save qualification settings.',
      );
    }
  }


  if (
    !user ||
    steps.length ===
      0
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Qualification...
      </div>
    );
  }


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
        currentStep="QUALIFICATION"
        steps={
          steps
        }
        title="Qualification"
        description="Configure how teams progress from groups into the knockout stage."
      >

        {error ? (
          <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-red-300">
            {error}
          </div>
        ) : null}


        <label>
          <span className="mb-2 block font-black">
            Teams Qualifying Per Group
          </span>

          <input
            type="number"
            min="1"
            max="64"
            value={
              qualifiers
            }
            onChange={
              (
                event,
              ) =>
                setQualifiers(
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
            }
            className="w-full rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
          />
        </label>


        <div className="mt-7">

          <p className="mb-3 font-black">
            Knockout Pairing Method
          </p>

          <div className="grid gap-3 md:grid-cols-2">

            {[
              [
                'CROSS_GROUP',
                'Cross Group Seeding',
              ],
              [
                'SEEDED',
                'Seeded Draw',
              ],
              [
                'RANDOM',
                'Random Draw',
              ],
              [
                'MANUAL',
                'Manual Draw',
              ],
            ].map(
              ([
                value,
                label,
              ]) => (
                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setMethod(
                      value,
                    )
                  }
                  className={`rounded-2xl border p-5 text-left font-black ${
                    method ===
                    value
                      ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
                      : 'border-white/10'
                  }`}
                >
                  {
                    label
                  }
                </button>
              ),
            )}

          </div>

        </div>


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
            onClick={() =>
              void save()
            }
            className="rounded-xl bg-sky-400 px-6 py-3 font-black text-[#041019]"
          >
            Save & Review →
          </button>

        </div>

      </TournamentWizardShell>

    </AppShell>
  );
}