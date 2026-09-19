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
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;
}


interface LeagueMember {
  membershipId: string;
  membershipType:
    | 'PRIMARY'
    | 'SECONDARY';
  joinedAt: string;

  user: {
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
    identityVerified: boolean;

    adminRole:
      | 'OWNER'
      | 'ADMIN'
      | null;
  };
}


export default function LeagueMembersPage() {
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
    members,
    setMembers,
  ] =
    useState<LeagueMember[]>(
      [],
    );

  const [
    search,
    setSearch,
  ] =
    useState('');

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


  async function loadMembers(
    value = '',
  ) {
    const query =
      value
        ? `?search=${encodeURIComponent(value)}`
        : '';

    const response =
      await authenticatedRequest<{
        success: true;
        data: {
          members:
            LeagueMember[];
        };
        error: null;
      }>(
        `/leagues/${leagueId}/members${query}`,
      );

    setMembers(
      response.data.members,
    );
  }


  useEffect(() => {
    async function load() {
      try {
        const [
          current,
          leagueResponse,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<{
              success: true;
              data: {
                league:
                  LeagueHome;
              };
              error: null;
            }>(
              `/leagues/${leagueId}`,
            ),
          ]);

        setUser(
          current,
        );

        setLeague(
          leagueResponse
            .data
            .league,
        );

        await loadMembers();
      } catch {
        router.replace(
          `/leagues/${leagueId}`,
        );
      }
    }

    void load();
  }, [
    leagueId,
    router,
  ]);


  async function searchMembers(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(
      '',
    );

    try {
      await loadMembers(
        search,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to search members.',
      );
    }
  }


  async function removeMember(
    member:
      LeagueMember,
  ) {
    if (
      !window.confirm(
        `Remove ${member.user.inGameName || member.user.fullName} from this League?`,
      )
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
      const response =
        await authenticatedRequest<{
          success: true;
          data: {
            message:
              string;
          };
          error: null;
        }>(
          `/leagues/${leagueId}/members/${member.user.id}`,
          {
            method:
              'DELETE',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadMembers(
        search,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove member.',
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
        label="Loading League Members..."
      />
    );
  }


  const isAdmin =
    Boolean(
      league.adminRole,
    );


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
          title="Members"
          subtitle="Players in this League. Admin member controls stay on this focused screen."
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


        <FcPanel className="p-5">
          <form
            onSubmit={
              searchMembers
            }
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={
                search
              }
              onChange={
                (
                  event,
                ) =>
                  setSearch(
                    event
                      .target
                      .value,
                  )
              }
              placeholder="Search member..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
            />

            <button
              type="submit"
              className="rounded-xl border border-sky-400/20 px-5 py-3 text-sm font-black text-sky-300"
            >
              Search
            </button>
          </form>
        </FcPanel>


        <section className="grid gap-3 lg:grid-cols-2">
          {members.map(
            (
              member,
            ) => (
              <FcPanel
                key={
                  member.membershipId
                }
                className="p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <FcStatusBadge
                        label={
                          member.membershipType
                        }
                        tone="cyan"
                      />

                      {member.user.adminRole ? (
                        <FcStatusBadge
                          label={
                            member.user.adminRole
                          }
                          tone="amber"
                        />
                      ) : null}

                      {member.user.identityVerified ? (
                        <FcStatusBadge
                          label="Verified"
                          tone="emerald"
                        />
                      ) : null}
                    </div>

                    <h2 className="mt-4 truncate text-lg font-black">
                      {member.user.inGameName ||
                        member.user.fullName}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        member.user.fullName
                      }
                    </p>

                    <p className="mt-2 font-mono text-xs text-sky-400">
                      {member.user.playerCode ||
                        'Player ID pending'}
                    </p>
                  </div>

                  {isAdmin &&
                  member.user.adminRole !==
                    'OWNER' &&
                  member.user.id !==
                    user.id ? (
                    <button
                      type="button"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        void removeMember(
                          member,
                        )
                      }
                      className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <p className="mt-4 text-xs text-slate-600">
                  Joined{' '}
                  {new Date(
                    member.joinedAt,
                  ).toLocaleDateString()}
                </p>
              </FcPanel>
            ),
          )}
        </section>


        {members.length ===
        0 ? (
          <FcPanel className="border-dashed p-10 text-center text-sm text-slate-500">
            No matching League members.
          </FcPanel>
        ) : null}
      </div>
    </AppShell>
  );
}
