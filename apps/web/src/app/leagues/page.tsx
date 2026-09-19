'use client';

import Link from 'next/link';
import type {
  FormEvent,
} from 'react';
import {
  useEffect,
  useMemo,
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
    selectedLeagueId,
    setSelectedLeagueId,
  ] =
    useState<string | null>(
      null,
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

    const items =
      response.data.leagues;

    setLeagues(
      items,
    );

    setSelectedLeagueId(
      (
        current,
      ) => {
        if (
          current &&
          items.some(
            (
              item,
            ) =>
              item.league.id ===
              current,
          )
        ) {
          return current;
        }

        return (
          items.find(
            (
              item,
            ) =>
              item.membershipType ===
              'PRIMARY',
          )
            ?.league.id ??
          items[0]
            ?.league.id ??
          null
        );
      },
    );
  }


  useEffect(() => {
    async function load() {
      try {
        const currentUser =
          await getCurrentUser();

        setUser(
          currentUser,
        );

        await loadLeagues();
      } catch {
        router.replace(
          '/login',
        );
      }
    }

    void load();
  }, [
    router,
  ]);


  const selected =
    useMemo(
      () =>
        leagues.find(
          (
            item,
          ) =>
            item.league.id ===
            selectedLeagueId,
        ) ??
        leagues.find(
          (
            item,
          ) =>
            item.membershipType ===
            'PRIMARY',
        ) ??
        leagues[0] ??
        null,
      [
        leagues,
        selectedLeagueId,
      ],
    );


  async function createLeague(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(true);
    setError('');
    setMessage('');

    const form =
      event.currentTarget;

    const data =
      new FormData(
        form,
      );

    try {
      const response =
        await authenticatedRequest<{
          data: {
            message:
              string;

            league: {
              id?: string;
              code: string;
            };
          };
        }>(
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
      setBusy(false);
    }
  }


  async function findLeague(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');
    setMessage('');
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
        await authenticatedRequest<{
          data: {
            league:
              LeaguePreview;
          };
        }>(
          `/leagues/code/${encodeURIComponent(
            code,
          )}`,
        );

      setPreview(
        response.data.league,
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

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response =
        await authenticatedRequest<{
          data: {
            message:
              string;
          };
        }>(
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
      setBusy(false);
    }
  }


  async function setPrimary(
    leagueId:
      string,
  ) {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response =
        await authenticatedRequest<{
          data: {
            message:
              string;
          };
        }>(
          `/leagues/${leagueId}/set-primary`,
          {
            method:
              'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadLeagues();

      setSelectedLeagueId(
        leagueId,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update primary League.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function leaveLeague(
    leagueId:
      string,
    leagueName:
      string,
  ) {
    if (
      !window.confirm(
        `Leave ${leagueName}? You will lose access to its member-only competitions.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response =
        await authenticatedRequest<{
          data: {
            message:
              string;
          };
        }>(
          `/leagues/${leagueId}/leave`,
          {
            method:
              'DELETE',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadLeagues();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to leave League.',
      );
    } finally {
      setBusy(false);
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
      <div className="space-y-7">
        <FcPageHeader
          eyebrow="Competition Communities"
          title="Leagues"
          subtitle="Manage your primary and secondary football communities, or join a new league using its unique code."
          action={
            <button
              type="button"
              onClick={() =>
                setShowCreate(
                  (
                    value,
                  ) =>
                    !value,
                )
              }
              className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019] transition hover:bg-sky-300"
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


        {showCreate ? (
          <FcPanel className="p-5 sm:p-6">
            <FcSectionHeading
              eyebrow="New Community"
              title="Create League"
            />

            <form
              onSubmit={
                createLeague
              }
              className="mt-5 grid gap-4 lg:grid-cols-2"
            >
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  League Name
                </span>

                <input
                  name="name"
                  required
                  placeholder="FC Arena Tamil League"
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-sky-400/50"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Region
                </span>

                <input
                  name="region"
                  placeholder="Tamil Nadu"
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-sky-400/50"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Description
                </span>

                <textarea
                  name="description"
                  rows={3}
                  placeholder="Tell players about the League"
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-sky-400/50"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Rules
                </span>

                <textarea
                  name="rules"
                  rows={3}
                  placeholder="Competition rules"
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-sky-400/50"
                />
              </label>

              <div className="flex gap-2 lg:col-span-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(
                      false,
                    )
                  }
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-400"
                >
                  Cancel
                </button>

                <button
                  disabled={
                    busy
                  }
                  className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019] disabled:opacity-50"
                >
                  {busy
                    ? 'Creating...'
                    : 'Create League'}
                </button>
              </div>
            </form>
          </FcPanel>
        ) : null}


        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <FcPanel className="p-5 sm:p-6">
            <FcSectionHeading
              eyebrow="League Switcher"
              title="My Leagues"
              action={
                <span className="text-xs font-black text-slate-600">
                  {
                    leagues.length
                  }
                  /2 joined
                </span>
              }
            />

            {leagues.length ===
            0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center">
                <p className="font-black text-slate-300">
                  No League memberships yet.
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  Find a league using a code or create your own.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {leagues.map(
                  (
                    item,
                  ) => {
                    const active =
                      selected
                        ?.league.id ===
                      item.league.id;

                    return (
                      <button
                        key={
                          item.league.id
                        }
                        type="button"
                        onClick={() =>
                          setSelectedLeagueId(
                            item.league.id,
                          )
                        }
                        className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                          active
                            ? 'border-sky-400/30 bg-sky-400/[0.07]'
                            : 'border-white/10 bg-[#0a1520] hover:border-sky-400/20'
                        }`}
                      >
                        <FcCrest
                          name={
                            item.league.name
                          }
                        />

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-black">
                              {
                                item.league.name
                              }
                            </span>

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
                          </span>

                          <span className="mt-1 block text-xs text-slate-600">
                            {
                              item.league.members
                            }
                            /
                            {
                              item.league.maxMembers
                            }
                            {' members · '}
                            {
                              item.league.region ||
                              'Region not set'
                            }
                          </span>
                        </span>

                        <span className="text-slate-700">
                          ›
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </FcPanel>


          <FcPanel className="p-5 sm:p-6">
            <FcSectionHeading
              eyebrow="Join With Code"
              title="Find League"
            />

            {atLimit ? (
              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                <p className="font-black text-amber-300">
                  Two-League limit reached
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Leave one of your current leagues before requesting another membership.
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
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono uppercase outline-none transition focus:border-sky-400/50"
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
                  />

                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-black tracking-wider text-sky-400">
                      {
                        preview.code
                      }
                    </p>

                    <h3 className="mt-1 truncate text-xl font-black">
                      {
                        preview.name
                      }
                    </h3>

                    <p className="mt-1 text-xs text-slate-600">
                      {preview.region ||
                        'Region not specified'}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm font-bold">
                  {
                    preview.members
                  }
                  /
                  {
                    preview.maxMembers
                  }{' '}
                  members
                </p>

                {preview.alreadyMember ? (
                  <Link
                    href={
                      `/leagues/${preview.id}`
                    }
                    className="mt-4 inline-flex rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
                  >
                    Enter League
                  </Link>
                ) : preview.applicationStatus ===
                  'PENDING' ? (
                  <FcStatusBadge
                    label="Join Request Pending"
                    tone="amber"
                  />
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
        </section>


        {selected ? (
          <section>
            <FcSectionHeading
              eyebrow="Selected League"
              title={
                selected.league.name
              }
            />

            <FcPanel className="mt-4 overflow-hidden">
              <div className="border-b border-white/[0.07] bg-[linear-gradient(120deg,rgba(14,165,233,0.08),transparent_60%)] p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <FcCrest
                      name={
                        selected.league.name
                      }
                      size="lg"
                    />

                    <div>
                      <p className="font-mono text-xs font-black text-sky-400">
                        {
                          selected.league.code
                        }
                      </p>

                      <h3 className="mt-1 text-2xl font-black">
                        {
                          selected.league.name
                        }
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {
                          selected.league.region ||
                          'FC ARENA League'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <FcStatusBadge
                      label={
                        selected.membershipType
                      }
                      tone="cyan"
                    />

                    <FcStatusBadge
                      label={
                        selected.adminRole ||
                        'PLAYER'
                      }
                      tone={
                        selected.adminRole
                          ? 'amber'
                          : 'slate'
                      }
                    />
                  </div>
                </div>
              </div>


              <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
                <div className="rounded-2xl bg-white/[0.025] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Members
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {
                      selected.league.members
                    }
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.025] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Pending
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {
                      selected.league.pendingApplications
                    }
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.025] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Slot
                  </p>

                  <p className="mt-2 text-lg font-black text-sky-300">
                    {
                      selected.membershipType
                    }
                  </p>
                </div>
              </div>


              <div className="flex flex-wrap gap-2 border-t border-white/[0.07] p-5 sm:p-6">
                <Link
                  href={
                    `/leagues/${selected.league.id}`
                  }
                  className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
                >
                  Open League
                </Link>

                <Link
                  href={
                    `/leagues/${selected.league.id}/tournaments`
                  }
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
                >
                  Tournaments
                </Link>

                {selected.membershipType ===
                'SECONDARY' ? (
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void setPrimary(
                        selected.league.id,
                      )
                    }
                    className="rounded-xl border border-emerald-400/20 px-4 py-3 text-sm font-black text-emerald-300 disabled:opacity-40"
                  >
                    Make Primary
                  </button>
                ) : null}

                {!selected.adminRole ? (
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void leaveLeague(
                        selected.league.id,
                        selected.league.name,
                      )
                    }
                    className="rounded-xl border border-red-400/20 px-4 py-3 text-sm font-black text-red-300 disabled:opacity-40"
                  >
                    Leave League
                  </button>
                ) : null}
              </div>
            </FcPanel>


            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <FcPanel className="p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                  League Info
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {selected.league.description ||
                    'No League description has been added yet.'}
                </p>

                <Link
                  href={
                    `/leagues/${selected.league.id}`
                  }
                  className="mt-4 inline-flex text-sm font-black text-sky-300"
                >
                  Members & Admin Tools →
                </Link>
              </FcPanel>

              <FcPanel className="p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                  Competition Data
                </p>

                <h3 className="mt-2 text-lg font-black">
                  Standings & Fixtures
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  League competitions and standings are managed through the tournaments created inside this league.
                </p>

                <Link
                  href={
                    `/leagues/${selected.league.id}/tournaments`
                  }
                  className="mt-4 inline-flex text-sm font-black text-sky-300"
                >
                  Open Competition Center →
                </Link>
              </FcPanel>
            </div>
          </section>
        ) : (
          <FcEmptyState
            title="Build your first League"
            description="Create a league or join one with a unique code. Each player can hold a maximum of two memberships."
            actionLabel="Create League"
            actionHref="/leagues"
          />
        )}
      </div>
    </AppShell>
  );
}
