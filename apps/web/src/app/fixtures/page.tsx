'use client';

import Link from 'next/link';
import {
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  fixtureGroupName,
  hubEntryName,
  type HubFixture,
  type HubTournament,
  loadAccessibleFixtures,
  loadAccessibleTournaments,
} from '@/lib/competition-hub';
import {
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

export default function FixturesHubPage() {
  const router =
    useRouter();

  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    tournaments,
    setTournaments,
  ] =
    useState<HubTournament[]>(
      [],
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<HubFixture[]>(
      [],
    );

  const [
    tournamentFilter,
    setTournamentFilter,
  ] =
    useState('ALL');

  const [error, setError] =
    useState('');

  async function loadData() {
    const competitions =
      await loadAccessibleTournaments();

    setTournaments(
      competitions,
    );

    setFixtures(
      await loadAccessibleFixtures(
        competitions,
      ),
    );
  }

  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        await loadData();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load fixtures.',
        );

        router.replace(
          '/login',
        );
      }
    }

    void load();
  }, [router]);

  const visibleFixtures =
    useMemo(
      () =>
        fixtures
          .filter(
            (fixture) =>
              tournamentFilter ===
                'ALL' ||
              fixture.tournament
                .id ===
                tournamentFilter,
          )
          .sort(
            (a, b) => {
              if (
                a.tournament.id ===
                b.tournament.id
              ) {
                return (
                  a.sequence -
                  b.sequence
                );
              }

              return a.tournament.name.localeCompare(
                b.tournament.name,
              );
            },
          ),
      [
        fixtures,
        tournamentFilter,
      ],
    );

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Fixtures...
      </div>
    );
  }

  return (
    <AppShell
      playerName={
        user.player?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
              Fixture Center
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-5xl">
              Fixtures
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Round-robin schedules, grouped fixtures and knockout matches from all your League tournaments in one place.
            </p>
          </div>

          <select
            value={
              tournamentFilter
            }
            onChange={(event) =>
              setTournamentFilter(
                event.target.value,
              )
            }
            className="rounded-xl border border-white/10 bg-[#0a1018] px-4 py-3 text-sm font-bold outline-none"
          >
            <option value="ALL">
              All Tournaments
            </option>

            {tournaments.map(
              (tournament) => (
                <option
                  key={tournament.id}
                  value={tournament.id}
                >
                  {tournament.name}
                </option>
              ),
            )}
          </select>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {visibleFixtures.length ===
        0 ? (
          <section className="rounded-[24px] border border-dashed border-white/10 bg-[#0a1018] p-10 text-center">
            <p className="text-lg font-black text-slate-300">
              No fixtures generated yet.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              A League Admin must close tournament registration and generate fixtures first.
            </p>

            <Link
              href="/tournaments"
              className="mt-5 inline-flex rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#041019]"
            >
              Open Tournaments
            </Link>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {visibleFixtures.map(
              (fixture) => {
                const group =
                  fixtureGroupName(
                    fixture.roundName,
                  );

                const home =
                  hubEntryName(
                    fixture.home,
                  );

                const away =
                  hubEntryName(
                    fixture.away,
                  );

                return (
                  <article
                    key={fixture.id}
                    className="rounded-[24px] border border-white/10 bg-[#0a1018] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                          {
                            fixture
                              .tournament
                              .name
                          }
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-600">
                          {
                            fixture
                              .tournament
                              .leagueName
                          }
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {group ? (
                          <span className="rounded-full bg-sky-400/10 px-3 py-1 text-[10px] font-black text-sky-300">
                            {group}
                          </span>
                        ) : null}

                        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-slate-400">
                          {fixture.status.replaceAll(
                            '_',
                            ' ',
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <p className="text-center text-lg font-black">
                        {home}
                      </p>

                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-500">
                        VS
                      </span>

                      <p className="text-center text-lg font-black">
                        {away}
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase text-slate-600">
                          Round
                        </p>

                        <p className="mt-1 text-sm font-black">
                          {fixture.roundName}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase text-slate-600">
                          Schedule
                        </p>

                        <p className="mt-1 text-sm font-black">
                          {fixture.scheduledAt
                            ? new Date(
                                fixture.scheduledAt,
                              ).toLocaleString()
                            : 'Not scheduled'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {fixture.match?.id ? (
                        <Link
                          href={`/matches/${fixture.match.id}`}
                          className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-black text-[#041019]"
                        >
                          Open Match
                        </Link>
                      ) : null}

                      <Link
                        href={`/tournaments/${fixture.tournament.id}`}
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-slate-300"
                      >
                        Tournament
                      </Link>
                    </div>
                  </article>
                );
              },
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
