'use client';

import Link from 'next/link';
import {
  useParams,
} from 'next/navigation';
import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awardedAt: string;

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

interface AchievementData {
  tournament: {
    id: string;
    name: string;
    code: string;
    mode: string;
    format: string;
    status: string;
    completedAt: string | null;
  };

  isLeagueAdmin: boolean;

  achievements:
    Achievement[];
}

function playerName(
  achievement: Achievement,
) {
  return (
    achievement.user.player
      ?.identity
      ?.inGameName ||
    achievement.user.fullName
  );
}

function iconFor(
  type: string,
) {
  switch (type) {
    case 'TOURNAMENT_CHAMPION':
      return '🏆';

    case 'TOURNAMENT_RUNNER_UP':
      return '🥈';

    case 'GOLDEN_BOOT':
      return '⚽';

    case 'BEST_PLAYER':
      return '⭐';

    case 'WINNING_STREAK':
      return '🔥';

    default:
      return '🎖';
  }
}

export default function AchievementsPage() {
  const params =
    useParams<{
      tournamentId: string;
    }>();

  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  const [data, setData] =
    useState<AchievementData | null>(
      null,
    );

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  async function load() {
    const response =
      await authenticatedRequest<{
        success: true;

        data:
          AchievementData;

        error: null;
      }>(
        `/tournaments/${params.tournamentId}/achievements`,
      );

    setData(
      response.data,
    );
  }

  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        await load();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load achievements.',
        );
      }
    })();
  }, [
    params.tournamentId,
  ]);

  async function completeTournament() {
    if (
      !window.confirm(
        'Complete this Tournament? Champion and verified achievements will be generated permanently.',
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data:
            AchievementData;

          error: null;
        }>(
          `/tournaments/${params.tournamentId}/complete`,
          {
            method: 'POST',
          },
        );

      setData(
        response.data,
      );

      setMessage(
        'Tournament completed and achievements generated.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to complete Tournament.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    !user ||
    !data
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        {error ||
          'Loading Achievements...'}
      </div>
    );
  }

  const headlineAwards =
    data.achievements.filter(
      (achievement) =>
        achievement.type !==
        'TOURNAMENT_PARTICIPATION',
    );

  const participation =
    data.achievements.filter(
      (achievement) =>
        achievement.type ===
        'TOURNAMENT_PARTICIPATION',
    );

  return (
    <AppShell
      playerName={
        user.player?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/tournaments/${params.tournamentId}`}
            className="text-sm font-bold text-slate-500 hover:text-white"
          >
            ← Tournament
          </Link>

          <Link
            href={`/tournaments/${params.tournamentId}/rankings`}
            className="text-sm font-bold text-sky-400"
          >
            Rankings
          </Link>
        </div>

        <section className="rounded-[30px] border border-white/10 bg-[#0a1018] p-8 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
            Hall of Champions
          </p>

          <h1 className="mt-3 text-4xl font-black md:text-6xl">
            {data.tournament.name}
          </h1>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-300">
              {data.tournament.mode}
            </span>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-slate-400">
              {data.tournament.status}
            </span>
          </div>

          {data.tournament.completedAt ? (
            <p className="mt-5 text-sm text-slate-500">
              Completed{' '}
              {new Date(
                data.tournament.completedAt,
              ).toLocaleString()}
            </p>
          ) : null}

          {data.isLeagueAdmin &&
          data.tournament.status !==
            'COMPLETED' &&
          data.tournament.status !==
            'CANCELLED' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void completeTournament()
              }
              className="mt-8 rounded-xl bg-amber-300 px-6 py-3 font-black text-black disabled:opacity-50"
            >
              Complete Tournament & Generate Achievements
            </button>
          ) : null}
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {data.tournament.status !==
        'COMPLETED' ? (
          <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-8 text-center">
            <p className="text-5xl">
              🏆
            </p>

            <h2 className="mt-4 text-2xl font-black">
              Tournament Still Active
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
              Achievements are generated only after all Tournament Matches are completed and results are verified.
            </p>
          </section>
        ) : null}

        {headlineAwards.length >
        0 ? (
          <section>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Official Awards
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {headlineAwards.map(
                (achievement) => (
                  <article
                    key={
                      achievement.id
                    }
                    className="relative overflow-hidden rounded-[24px] border border-amber-400/15 bg-[#0a1018] p-6"
                  >
                    <div className="absolute -right-6 -top-6 text-8xl opacity-[0.05]">
                      {iconFor(
                        achievement.type,
                      )}
                    </div>

                    <p className="text-4xl">
                      {iconFor(
                        achievement.type,
                      )}
                    </p>

                    <h2 className="mt-5 text-xl font-black">
                      {
                        achievement.title
                      }
                    </h2>

                    <p className="mt-3 text-lg font-black text-sky-400">
                      {playerName(
                        achievement,
                      )}
                    </p>

                    <p className="mt-1 font-mono text-xs text-slate-600">
                      {achievement.user
                        .player
                        ?.playerCode ||
                        '—'}
                    </p>

                    {achievement.description ? (
                      <p className="mt-4 text-sm leading-6 text-slate-500">
                        {
                          achievement.description
                        }
                      </p>
                    ) : null}
                  </article>
                ),
              )}
            </div>
          </section>
        ) : null}

        {participation.length >
        0 ? (
          <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Tournament Participants
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {participation.map(
                (achievement) => (
                  <div
                    key={
                      achievement.id
                    }
                    className="rounded-xl border border-white/5 bg-black/10 p-4"
                  >
                    <p className="font-black">
                      🎖{' '}
                      {playerName(
                        achievement,
                      )}
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      Tournament Participation
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>
        ) : null}

        {data.tournament.status ===
          'COMPLETED' &&
        data.achievements.length ===
          0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0a1018] p-10 text-center text-slate-500">
            No achievements were generated.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}