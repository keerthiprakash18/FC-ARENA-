'use client';

import Link from 'next/link';
import type {
  FormEvent,
} from 'react';
import {
  useEffect,
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FcCrest,
  FcEmptyState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcSectionHeading,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


interface MyLeague {
  membershipType:
    | 'PRIMARY'
    | 'SECONDARY';

  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

  league: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
    description: string | null;
    region: string | null;
    members: number;
    maxMembers: number;
    pendingApplications: number;
  };
}


interface LeaguePreview {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  description: string | null;
  region: string | null;
  members: number;
  maxMembers: number;
  alreadyMember: boolean;
  applicationStatus: string | null;
}


export default function LeaguesPage() {
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
    leagues,
    setLeagues,
  ] =
    useState<MyLeague[]>(
      [],
    );

  const [
    preview,
    setPreview,
  ] =
    useState<LeaguePreview | null>(
      null,
    );

  const [
    showCreate,
    setShowCreate,
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

  const [
    busy,
    setBusy,
  ] =
    useState(false);


  async function loadLeagues() {
    const response =
      await authenticatedRequest<{
        data: {
          leagues:
            MyLeague[];
        };
      }>(
        '/leagues/my',
      );

    setLeagues(
      response.data.leagues,
    );
  }


  useEffect(() => {
    void (async () => {
      try {
        setUser(
          await getCurrentUser(),
        );

        await loadLeagues();
      } catch {
        router.replace(
          '/login',
        );
      }
    })();
  }, [
    router,
  ]);


  async function createLeague(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(
      true,
    );

    setError(
      '',
    );

    setMessage(
      '',
    );

    const form =
      event.currentTarget;

    const data =
      new FormData(
        form,
      );

    try {
      const response =
        await authenticatedRequest<any>(
          '/leagues',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                name:
                  String(
                    data.get(
                      'name',
                    ) ??
                    '',
                  ),

                region:
                  String(
                    data.get(
                      'region',
                    ) ??
                    '',
                  ) ||
                  undefined,

                description:
                  String(
                    data.get(
                      'description',
                    ) ??
                    '',
                  ) ||
                  undefined,

                rules:
                  String(
                    data.get(
                      'rules',
                    ) ??
                    '',
                  ) ||
                  undefined,
              }),
          },
        );

      setMessage(
        `${response.data.message} Code: ${response.data.league.code}`,
      );

      form.reset();

      setShowCreate(
        false,
      );

      await loadLeagues();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create League.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function findLeague(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(
      '',
    );

    setMessage(
      '',
    );

    setPreview(
      null,
    );

    const form =
      new FormData(
        event.currentTarget,
      );

    const code =
      String(
        form.get(
          'code',
        ) ??
        '',
      )
        .trim()
        .toUpperCase();

    try {
      const response =
        await authenticatedRequest<any>(
          `/leagues/code/${encodeURIComponent(code)}`,
        );

      setPreview(
        response
          .data
          .league,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'League not found.',
      );
    }
  }


  async function requestJoin() {
    if (
      !preview ||
      leagues.length >=
        2
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          '/leagues/join',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                code:
                  preview.code,
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      setPreview({
        ...preview,
        applicationStatus:
          'PENDING',
      });
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to request membership.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  if (!user) {
    return (
      <FcLoadingScreen
        label="Loading Leagues..."
      />
    );
  }


  const atLimit =
    leagues.length >=
    2;


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <FcPageHeader
          title="Leagues"
          subtitle="Manage your League memberships and join or create a competition."
          action={
            <button
              type="button"
              disabled={
                atLimit
              }
              onClick={() =>
                setShowCreate(
                  (
                    value,
                  ) =>
                    !value,
                )
              }
              className="min-h-11 rounded-[10px] bg-[#38BDF8] px-4 text-sm font-semibold text-[#071018] hover:bg-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Create League
            </button>
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


        <section>
          <FcSectionHeading
            eyebrow="Memberships"
            title="My Leagues"
            action={
              <span className="text-xs font-black text-slate-600">
                {
                  leagues.length
                }
                /2
              </span>
            }
          />

          {leagues.length ===
          0 ? (
            <div className="mt-4">
              <FcEmptyState
                title="No League memberships"
                description="Join a League with a unique code or create your own football community."
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {leagues.map(
                (
                  item,
                ) => (
                  <Link
                    key={
                      item.league.id
                    }
                    href={
                      `/leagues/${item.league.id}`
                    }
                    className="group rounded-2xl border border-[#253140] bg-[#121821] p-5 transition duration-200 hover:border-[#334155] hover:bg-[#151C26]"
                  >
                    <div className="flex items-start gap-4">
                      <FcCrest
                        name={
                          item.league.name
                        }
                        imageUrl={
                          item.league.logoUrl
                        }
                        size="lg"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          <FcStatusBadge
                            label={
                              item.membershipType
                            }
                            tone={
                              item.membershipType ===
                              'PRIMARY'
                                ? 'cyan'
                                : 'slate'
                            }
                          />

                          {item.adminRole ? (
                            <FcStatusBadge
                              label={
                                item.adminRole
                              }
                              tone="amber"
                            />
                          ) : null}
                        </div>

                        <h2 className="mt-3 truncate text-lg font-semibold">
                          {
                            item.league.name
                          }
                        </h2>

                        <p className="mt-1 text-xs text-slate-600">
                          {
                            item.league.region ||
                            'Region not specified'
                          }
                          {' · '}
                          {
                            item.league.members
                          }
                          /
                          {
                            item.league.maxMembers
                          }{' '}
                          members
                        </p>
                      </div>

                      <span className="text-xl text-slate-700 transition group-hover:translate-x-1 group-hover:text-sky-300">
                        ›
                      </span>
                    </div>

                    <div className="mt-5 border-t border-white/[0.06] pt-4">
                      <p className="line-clamp-2 text-sm leading-6 text-slate-500">
                        {item.league.description ||
                          'Open the League for overview, standings, fixtures, members, teams and settings.'}
                      </p>
                    </div>
                  </Link>
                ),
              )}
            </div>
          )}
        </section>


        <section className="grid gap-5 xl:grid-cols-2">
          <FcPanel className="p-5 sm:p-6">
            <FcSectionHeading
              eyebrow="Join"
              title="League Code"
            />

            {atLimit ? (
              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                <p className="font-black text-amber-300">
                  Two-League limit reached
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Leave one current League before joining another.
                </p>
              </div>
            ) : (
              <form
                onSubmit={
                  findLeague
                }
                className="mt-5 flex gap-2"
              >
                <input
                  name="code"
                  required
                  placeholder="LEAGUE CODE"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono uppercase outline-none focus:border-sky-400/50"
                />

                <button className="rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-5 text-sm font-black text-sky-300">
                  Find
                </button>
              </form>
            )}


            {preview ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-[#0a1520] p-5">
                <div className="flex items-center gap-4">
                  <FcCrest
                    name={
                      preview.name
                    }
                    imageUrl={
                      preview.logoUrl
                    }
                  />

                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-black text-sky-400">
                      {
                        preview.code
                      }
                    </p>

                    <h3 className="mt-1 truncate text-lg font-black">
                      {
                        preview.name
                      }
                    </h3>

                    <p className="mt-1 text-xs text-slate-600">
                      {
                        preview.members
                      }
                      /
                      {
                        preview.maxMembers
                      }{' '}
                      members
                    </p>
                  </div>
                </div>

                {preview.alreadyMember ? (
                  <Link
                    href={
                      `/leagues/${preview.id}`
                    }
                    className="mt-4 inline-flex rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
                  >
                    Open League
                  </Link>
                ) : preview.applicationStatus ===
                  'PENDING' ? (
                  <div className="mt-4">
                    <FcStatusBadge
                      label="Join Request Pending"
                      tone="amber"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={
                      busy ||
                      atLimit
                    }
                    onClick={() =>
                      void requestJoin()
                    }
                    className="mt-4 rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019] disabled:opacity-40"
                  >
                    Request to Join
                  </button>
                )}
              </div>
            ) : null}
          </FcPanel>


          <FcPanel className="p-5 sm:p-6">
            <FcSectionHeading
              eyebrow="Create"
              title="New League"
            />

            {!showCreate ? (
              <div className="mt-5">
                <p className="text-sm leading-6 text-slate-500">
                  League creation stays on this primary screen because it is the entry point into the League section.
                </p>

                <button
                  type="button"
                  disabled={
                    atLimit
                  }
                  onClick={() =>
                    setShowCreate(
                      true,
                    )
                  }
                  className="mt-5 rounded-xl border border-sky-400/20 px-5 py-3 text-sm font-black text-sky-300 disabled:opacity-40"
                >
                  Create League
                </button>
              </div>
            ) : (
              <form
                onSubmit={
                  createLeague
                }
                className="mt-5 grid gap-4"
              >
                <input
                  name="name"
                  required
                  placeholder="League name"
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                />

                <input
                  name="region"
                  placeholder="Region"
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                />

                <textarea
                  name="description"
                  rows={3}
                  placeholder="Description"
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                />

                <textarea
                  name="rules"
                  rows={3}
                  placeholder="Rules"
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCreate(
                        false,
                      )
                    }
                    className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-400"
                  >
                    Cancel
                  </button>

                  <button
                    disabled={
                      busy
                    }
                    className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019] disabled:opacity-40"
                  >
                    {busy
                      ? 'Creating...'
                      : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </FcPanel>
        </section>
      </div>
    </AppShell>
  );
}
