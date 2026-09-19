'use client';

import {
  useParams,
  useRouter,
} from 'next/navigation';
import type {
  FormEvent,
} from 'react';
import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  BackHeader,
} from '@/components/app/back-header';

import {
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


interface Tournament {
  id: string;
  name: string;
  code: string;
  mode: string;
  status: string;
  teamSize: number;
  maxEntries: number;
  approvedEntries: number;
}


export default function TournamentRegistrationPage() {
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
    tournament,
    setTournament,
  ] =
    useState<Tournament | null>(
      null,
    );

  const [
    playerCodes,
    setPlayerCodes,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');


  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          response,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}`,
            ),
          ]);

        setUser(
          current,
        );

        setTournament(
          response
            .data
            .tournament,
        );

        if (
          current.player
            ?.playerCode
        ) {
          setPlayerCodes(
            current.player
              .playerCode,
          );
        }
      } catch {
        router.replace(
          `/tournaments/${tournamentId}`,
        );
      }
    })();
  }, [
    router,
    tournamentId,
  ]);


  async function submitRegistration(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !tournament
    ) {
      return;
    }

    setBusy(
      true,
    );

    setMessage(
      '',
    );

    setError(
      '',
    );

    const data =
      new FormData(
        event.currentTarget,
      );

    const codes =
      playerCodes
        .split(
          /[\n,]+/,
        )
        .map(
          (
            value,
          ) =>
            value
              .trim()
              .toUpperCase(),
        )
        .filter(
          Boolean,
        );

    try {
      const response =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/register`,
          {
            method:
              'POST',

            body:
              JSON.stringify({
                entryName:
                  String(
                    data.get(
                      'entryName',
                    ) ??
                    '',
                  ) ||
                  undefined,

                playerCodes:
                  codes,
              }),
          },
        );

      setMessage(
        response.data.message,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to register.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  if (
    !user ||
    !tournament
  ) {
    return (
      <FcLoadingScreen
        label="Loading Registration..."
      />
    );
  }


  const registrationOpen =
    tournament.status ===
    'REGISTRATION_OPEN';


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <BackHeader
          backHref={
            `/tournaments/${tournamentId}`
          }
          backLabel="Tournament Overview"
          eyebrow={
            tournament.name
          }
          title="Registration"
          subtitle="Submit your Tournament entry without mixing registration forms into the Overview screen."
          action={
            <FcStatusBadge
              label={
                registrationOpen
                  ? 'Registration Open'
                  : 'Registration Closed'
              }
              tone={
                registrationOpen
                  ? 'emerald'
                  : 'amber'
              }
            />
          }
        />

        <TournamentNavigation
          tournamentId={
            tournamentId
          }
        />


        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">
            {
              message
            }
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


        <FcPanel className="p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Participation
              </p>
              <p className="mt-2 font-black">
                {
                  tournament.mode
                }
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Players Per Entry
              </p>
              <p className="mt-2 font-black">
                {
                  tournament.teamSize
                }
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Approved Entries
              </p>
              <p className="mt-2 font-black">
                {
                  tournament.approvedEntries
                }
                /
                {
                  tournament.maxEntries
                }
              </p>
            </div>
          </div>
        </FcPanel>


        {registrationOpen ? (
          <FcPanel className="p-5 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
              Entry Form
            </p>

            <h2 className="mt-2 text-xl font-black">
              Join Tournament
            </h2>

            <form
              onSubmit={
                submitRegistration
              }
              className="mt-5 grid gap-4"
            >
              {tournament.mode !==
              'SOLO' ? (
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {tournament.mode ===
                    'DUO'
                      ? 'Duo Name'
                      : 'Team Name'}
                  </span>

                  <input
                    name="entryName"
                    required
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                  />
                </label>
              ) : null}


              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  FC ARENA Player IDs
                </span>

                <textarea
                  value={
                    playerCodes
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setPlayerCodes(
                        event
                          .target
                          .value,
                      )
                  }
                  rows={
                    Math.max(
                      3,
                      tournament.teamSize,
                    )
                  }
                  required
                  placeholder="One Player ID per line"
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono outline-none focus:border-sky-400/50"
                />
              </label>


              <button
                disabled={
                  busy
                }
                className="rounded-xl bg-sky-400 px-5 py-3 font-black text-[#031019] disabled:opacity-40"
              >
                {busy
                  ? 'Submitting...'
                  : 'Submit Registration'}
              </button>
            </form>
          </FcPanel>
        ) : (
          <FcPanel className="border-amber-400/15 p-6">
            <p className="font-black text-amber-300">
              Registration is currently closed.
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tournament admins control registration status from the dedicated Settings screen.
            </p>
          </FcPanel>
        )}
      </div>
    </AppShell>
  );
}
