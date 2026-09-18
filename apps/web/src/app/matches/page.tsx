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
  hubEntryName,
  type HubFixture,
  loadAccessibleFixtures,
  loadAccessibleTournaments,
} from '@/lib/competition-hub';
import {
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

type MatchFilter =
  | 'ALL'
  | 'UPCOMING'
  | 'COMPLETED';

export default function MatchesHubPage() {
  const router =
    useRouter();

  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<HubFixture[]>(
      [],
    );

  const [
    filter,
    setFilter,
  ] =
    useState<MatchFilter>(
      'ALL',
    );

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        const tournaments =
          await loadAccessibleTournaments();

        setFixtures(
          await loadAccessibleFixtures(
            tournaments,
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load matches.',
        );

        router.replace(
          '/login',
        );
      }
    }

    void load();
  }, [router]);

  const matches =
    useMemo(
      () =>
        fixtures
          .filter(
            (fixture) =>
              Boolean(
                fixture.match?.id,
              ),
          )
          .filter(
            (fixture) => {
              if (
                filter === 'ALL'
              ) {
                return true;
              }

              if (
                filter ===
                'COMPLETED'
              ) {
                return (
                  fixture.match
                    ?.status ===
                    'COMPLETED'
                );
              }

              return (
                fixture.match
                  ?.status !==
                  'COMPLETED' &&
                fixture.status !==
                  'CANCELLED'
              );
            },
          )
          .sort(
            (a, b) => {
              const aTime =
                a.scheduledAt
                  ? new Date(
                      a.scheduledAt,
                    ).getTime()
                  : Number.MAX_SAFE_INTEGER;

              const bTime =
                b.scheduledAt
                  ? new Date(
                      b.scheduledAt,
                    ).getTime()
                  : Number.MAX_SAFE_INTEGER;

              return (
                aTime - bTime ||
                a.sequence -
                  b.sequence
              );
            },
          ),
      [fixtures, filter],
    );

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Match System...
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
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            Match Operations
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-5xl">
            Match System
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Open each generated match for scheduling, result submission, screenshot OCR verification and admin confirmation.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          {(
            [
              'ALL',
              'UPCOMING',
              'COMPLETED',
            ] as MatchFilter[]
          ).map(
            (value) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setFilter(value)
                }
                className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                  filter === value
                    ? 'bg-sky-400 text-[#041019]'
                    : 'border border-white/10 bg-white/[0.03] text-slate-400'
                }`}
              >
                {value}
              </button>
            ),
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {matches.length === 0 ? (
          <section className="rounded-[24px] border border-dashed border-white/10 bg-[#0a1018] p-10 text-center">
            <p className="text-lg font-black text-slate-300">
              No matches in this view.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Matches are created automatically when tournament fixtures are generated.
            </p>

            <Link
              href="/fixtures"
              className="mt-5 inline-flex rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#041019]"
            >
              Open Fixtures
            </Link>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {matches.map(
              (fixture) => {
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
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                          {
                            fixture
                              .tournament
                              .name
                          }
                        </p>

                        <p className="mt-1 font-mono text-xs text-slate-600">
                          {fixture.match
                            ?.matchCode ||
                            fixture.fixtureCode}
                        </p>
                      </div>

                      <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-slate-400">
                        {(
                          fixture.match
                            ?.status ||
                          fixture.status
                        ).replaceAll(
                          '_',
                          ' ',
                        )}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <p className="text-center text-lg font-black">
                        {home}
                      </p>

                      <span className="rounded-full bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-300">
                        VS
                      </span>

                      <p className="text-center text-lg font-black">
                        {away}
                      </p>
                    </div>

                    <div className="mt-5 rounded-xl bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black">
                          {fixture.roundName}
                        </p>

                        <p className="text-xs text-slate-500">
                          {fixture.scheduledAt
                            ? new Date(
                                fixture.scheduledAt,
                              ).toLocaleString()
                            : 'Schedule pending'}
                        </p>
                      </div>
                    </div>

                    {fixture.match?.id ? (
                      <Link
                        href={`/matches/${fixture.match.id}`}
                        className="mt-4 inline-flex rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#041019]"
                      >
                        Open Match Center
                      </Link>
                    ) : null}
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
