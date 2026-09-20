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

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  BackHeader,
} from '@/components/app/back-header';

import {
  FcCrest,
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
} from '@/components/fc/fc-ui';

import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';


interface Entry {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
  fixtureCount: number;
}


interface Tournament {
  id: string;
  name: string;
  maxEntries: number;
  isLeagueAdmin: boolean;
}


export default function TournamentTeamsPage() {
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
    entries,
    setEntries,
  ] =
    useState<Entry[]>(
      [],
    );


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


  async function loadEntries() {
    const teams =
      await authenticatedRequest<any>(
        `/tournaments/${tournamentId}/entries`,
      );

    setEntries(
      teams
        .data
        .entries,
    );
  }


  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          competition,
          teams,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}`,
            ),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/entries`,
            ),
          ]);

        setUser(
          current,
        );

        setTournament(
          competition
            .data
            .tournament,
        );

        setEntries(
          teams
            .data
            .entries,
        );
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


  async function deleteTeam(
    entry:
      Entry,
  ) {
    if (
      !tournament
        ?.isLeagueAdmin
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        entry.fixtureCount >
        0
          ? `Delete "${entry.entryName ?? 'this team'}"? It is already linked to ${entry.fixtureCount} fixture(s). The server will block unsafe removal when required.`
          : `Delete "${entry.entryName ?? 'this team'}" from this Tournament?`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      '',
    );

    setMessage(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/entries/${entry.id}`,
        {
          method:
            'DELETE',
        },
      );

      setMessage(
        'Team deleted from Tournament.',
      );

      await loadEntries();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete team.',
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
        label="Loading Tournament Teams..."
      />
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
      <div className="space-y-6">
        <BackHeader
          backHref={
            `/tournaments/${tournamentId}`
          }
          backLabel="Tournament Overview"
          eyebrow={
            tournament.name
          }
          title="Teams"
          subtitle="Tournament entries only. Group assignment and fixture scheduling stay on their own dedicated screens."
        />

        <TournamentNavigation
          tournamentId={
            tournamentId
          }
        />


        {tournament.isLeagueAdmin ? (
          <FcPanel className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Team Management
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Add, edit, import, reorder or delete Tournament teams.
                </p>
              </div>

              <Link
                href={
                  `/tournaments/${tournamentId}/wizard/teams`
                }
                className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-sky-400 px-4 text-sm font-black text-[#031019]"
              >
                + Add / Manage Teams
              </Link>
            </div>
          </FcPanel>
        ) : null}


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


        {entries.length ===
        0 ? (
          <FcEmptyState
            title="No Tournament teams yet"
            description="Teams will appear here once entries are added or approved."
            actionLabel="Open Registration"
            actionHref={
              `/tournaments/${tournamentId}/registration`
            }
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entries.map(
              (
                entry,
              ) => (
                <FcPanel
                  key={
                    entry.id
                  }
                  className="p-5"
                >
                  <div className="flex items-center gap-4">
                    <FcCrest
                      name={
                        entry.entryName ||
                        'FC Team'
                      }
                      imageUrl={
                        entry.entryLogoUrl
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-black">
                        {entry.entryName ||
                          'Unnamed Team'}
                      </h2>

                      <p className="mt-1 text-xs text-slate-600">
                        {
                          entry.fixtureCount
                        }{' '}
                        fixtures
                      </p>
                    </div>
                  </div>

                  {tournament.isLeagueAdmin ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                      <Link
                        href={
                          `/tournaments/${tournamentId}/wizard/teams`
                        }
                        className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 px-3.5 text-xs font-semibold text-slate-500 transition hover:text-white"
                      >
                        Edit Team
                      </Link>

                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void deleteTeam(
                            entry,
                          )
                        }
                        className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-red-400/30 bg-red-400/[0.04] px-3.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/[0.08] disabled:opacity-40"
                      >
                        Delete Team
                      </button>
                    </div>
                  ) : null}
                </FcPanel>
              ),
            )}
          </section>
        )}


        <FcPanel className="p-5">
          <p className="text-sm leading-6 text-slate-500">
            {entries.length} of {tournament.maxEntries} Tournament entry slots currently contain real team data.
          </p>
        </FcPanel>
      </div>
    </AppShell>
  );
}
