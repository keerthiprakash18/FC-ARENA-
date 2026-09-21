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
  BackHeader,
} from '@/components/app/back-header';

import {
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  LeagueNavigation,
} from '@/components/leagues/league-navigation';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


interface LeagueHome {
  id: string;
  name: string;
  code: string;
  description: string | null;
  region: string | null;
  rules: string | null;
  membershipType:
    | 'PRIMARY'
    | 'SECONDARY';
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;
  pendingApplications: number;
}


interface Application {
  id: string;

  user: {
    id: string;
    fullName: string;

    player: {
      playerCode: string;
      identity: {
        inGameName: string;
      } | null;
    } | null;
  };
}


export default function LeagueSettingsPage() {
  const {
    leagueId,
  } =
    useParams<{
      leagueId:
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
    league,
    setLeague,
  ] =
    useState<LeagueHome | null>(
      null,
    );

  const [
    applications,
    setApplications,
  ] =
    useState<Application[]>(
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


  async function load() {
    const leagueResponse =
      await authenticatedRequest<any>(
        `/leagues/${leagueId}`,
      );

    const currentLeague:
      LeagueHome =
      leagueResponse
        .data
        .league;

    setLeague(
      currentLeague,
    );

    if (
      currentLeague.adminRole
    ) {
      const response =
        await authenticatedRequest<any>(
          `/leagues/${leagueId}/applications`,
        );

      setApplications(
        response
          .data
          .applications,
      );
    }
  }


  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        setUser(
          current,
        );

        await load();
      } catch {
        router.replace(
          `/leagues/${leagueId}`,
        );
      }
    })();
  }, [
    leagueId,
    router,
  ]);


  async function copyCode() {
    if (!league) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        league.code,
      );

      setMessage(
        'League Code copied.',
      );
    } catch {
      setError(
        'Unable to copy League Code.',
      );
    }
  }


  async function setPrimary() {
    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          `/leagues/${leagueId}/set-primary`,
          {
            method:
              'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update Primary League.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function leaveLeague() {
    if (
      !league ||
      !window.confirm(
        `Leave ${league.name}?`,
      )
    ) {
      return;
    }

    setBusy(
      true,
    );

    try {
      await authenticatedRequest(
        `/leagues/${leagueId}/leave`,
        {
          method:
            'DELETE',
        },
      );

      router.push(
        '/leagues',
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to leave League.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function deleteLeague() {
    if (
      !league ||
      league.adminRole !==
        'OWNER'
    ) {
      return;
    }

    const confirmation =
      window.prompt(
        `This permanently deletes "${league.name}" and its tournaments, fixtures, standings and League memberships. Type the League name exactly to continue.`,
      );

    if (
      confirmation ===
      null
    ) {
      return;
    }

    if (
      confirmation.trim() !==
      league.name.trim()
    ) {
      setError(
        'League name confirmation does not match.',
      );

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
        `/leagues/${leagueId}`,
        {
          method:
            'DELETE',

          body:
            JSON.stringify({
              confirmName:
                confirmation,
            }),
        },
      );

      router.replace(
        '/leagues',
      );

      router.refresh();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete League.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function reviewApplication(
    applicationId:
      string,

    action:
      'approve'
      | 'reject',
  ) {
    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          `/leagues/${leagueId}/applications/${applicationId}/${action}`,
          {
            method:
              'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to review application.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  if (
    !user ||
    !league
  ) {
    return (
      <FcLoadingScreen
        label="Loading League Settings..."
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
            `/leagues/${leagueId}`
          }
          backLabel="League Overview"
          eyebrow={
            league.name
          }
          title="Settings"
          subtitle={
            league.adminRole
              ? 'League access, join requests and membership controls.'
              : 'Your membership and League information.'
          }
        />

        <LeagueNavigation
          leagueId={
            leagueId
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
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                League Code
              </p>

              <p className="mt-2 font-mono text-xl font-black text-sky-300">
                {
                  league.code
                }
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void copyCode()
              }
              className="rounded-xl border border-sky-400/20 px-4 py-3 text-sm font-black text-sky-300"
            >
              Copy Code
            </button>
          </div>


          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Membership
              </p>

              <p className="mt-2 font-black">
                {
                  league.membershipType
                }
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Role
              </p>

              <p className="mt-2 font-black">
                {league.adminRole ||
                  'PLAYER'}
              </p>
            </div>
          </div>


          <div className="mt-5 flex flex-wrap gap-2">
            {league.membershipType ===
            'SECONDARY' ? (
              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  void setPrimary()
                }
                className="rounded-xl border border-emerald-400/20 px-4 py-3 text-sm font-black text-emerald-300 disabled:opacity-40"
              >
                Make Primary
              </button>
            ) : null}

            {league.adminRole !==
            'OWNER' ? (
              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  void leaveLeague()
                }
                className="rounded-xl border border-red-400/20 px-4 py-3 text-sm font-black text-red-300 disabled:opacity-40"
              >
                Leave League
              </button>
            ) : null}
          </div>
        </FcPanel>


        <FcPanel className="p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
            League Information
          </p>

          <h2 className="mt-2 text-xl font-black">
            {
              league.name
            }
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {
              league.region ||
              'Region not specified'
            }
          </p>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-500">
            {league.rules ||
              'No League rules have been added.'}
          </p>
        </FcPanel>


        {league.adminRole ? (
          <FcPanel className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                  Security
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Roles & Audit
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Assign scoped responsibilities and review permission changes recorded by FC ARENA.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/leagues/${leagueId}/roles`,
                  )
                }
                className="min-h-11 shrink-0 rounded-xl border border-sky-400/20 px-4 text-sm font-black text-sky-300"
              >
                Manage Roles
              </button>
            </div>
          </FcPanel>
        ) : null}


        {league.adminRole ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                  Admin
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Join Requests
                </h2>
              </div>

              <FcStatusBadge
                label={
                  `${applications.length} Pending`
                }
                tone="amber"
              />
            </div>

            <div className="grid gap-3">
              {applications.map(
                (
                  application,
                ) => (
                  <FcPanel
                    key={
                      application.id
                    }
                    className="p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black">
                          {application
                            .user
                            .player
                            ?.identity
                            ?.inGameName ||
                            application
                              .user
                              .fullName}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {
                            application
                              .user
                              .fullName
                          }
                        </p>

                        <p className="mt-2 font-mono text-xs text-sky-400">
                          {application
                            .user
                            .player
                            ?.playerCode ||
                            'Player ID pending'}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void reviewApplication(
                              application.id,
                              'approve',
                            )
                          }
                          className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-[#031019] disabled:opacity-40"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void reviewApplication(
                              application.id,
                              'reject',
                            )
                          }
                          className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-black text-red-300 disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </FcPanel>
                ),
              )}

              {applications.length ===
              0 ? (
                <FcPanel className="border-dashed p-8 text-center text-sm text-slate-500">
                  No pending join requests.
                </FcPanel>
              ) : null}
            </div>
          </section>
        ) : null}


        {league.adminRole ===
        'OWNER' ? (
          <FcPanel className="border-red-400/20 p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-300">
                  Danger Zone
                </p>

                <h2 className="mt-2 text-lg font-semibold text-[#F8FAFC]">
                  Delete League
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A7B0BE]">
                  Permanently deletes this League and all League-owned tournaments, fixtures, standings, applications and memberships. This action cannot be undone.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  void deleteLeague()
                }
                className="min-h-11 shrink-0 rounded-[10px] border border-red-400/35 bg-red-400/[0.06] px-5 text-sm font-semibold text-red-300 transition hover:bg-red-400/[0.10] disabled:opacity-40"
              >
                Delete League
              </button>
            </div>
          </FcPanel>
        ) : null}
      </div>
    </AppShell>
  );
}
