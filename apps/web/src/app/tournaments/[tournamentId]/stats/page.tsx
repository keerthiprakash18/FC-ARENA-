'use client';

import {
  useParams,
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useMemo,
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
  FcStatCard,
} from '@/components/fc/fc-ui';

import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


interface Standing {
  position: number;
  registrationId: string;
  entryName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}


export default function TournamentStatsPage() {
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
    name,
    setName,
  ] =
    useState('');

  const [
    standings,
    setStandings,
  ] =
    useState<Standing[]>(
      [],
    );


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
              `/tournaments/${tournamentId}/standings`,
            ),
          ]);

        setUser(
          current,
        );

        setName(
          response
            .data
            .tournament
            .name,
        );

        setStandings(
          response
            .data
            .standings,
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


  const totals =
    useMemo(
      () => {
        const played =
          standings.reduce(
            (
              total,
              row,
            ) =>
              total +
              row.played,
            0,
          );

        return {
          matches:
            Math.floor(
              played /
              2,
            ),

          goals:
            standings.reduce(
              (
                total,
                row,
              ) =>
                total +
                row.goalsFor,
              0,
            ),

          wins:
            standings.reduce(
              (
                total,
                row,
              ) =>
                total +
                row.wins,
              0,
            ),

          draws:
            Math.floor(
              standings.reduce(
                (
                  total,
                  row,
                ) =>
                  total +
                  row.draws,
                0,
              ) /
                2,
            ),
        };
      },
      [
        standings,
      ],
    );


  if (
    !user ||
    !name
  ) {
    return (
      <FcLoadingScreen
        label="Loading Tournament Stats..."
      />
    );
  }


  const ranked =
    [
      ...standings,
    ].sort(
      (
        first,
        second,
      ) =>
        second.points -
          first.points ||
        second.goalDifference -
          first.goalDifference ||
        second.goalsFor -
          first.goalsFor,
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
            `/tournaments/${tournamentId}`
          }
          backLabel="Tournament Overview"
          eyebrow={
            name
          }
          title="Statistics"
          subtitle="Competition-level summary derived from the real standings data."
        />

        <TournamentNavigation
          tournamentId={
            tournamentId
          }
        />


        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FcStatCard
            label="Completed Matches"
            value={
              totals.matches
            }
          />

          <FcStatCard
            label="Goals"
            value={
              totals.goals
            }
            tone="amber"
          />

          <FcStatCard
            label="Wins"
            value={
              totals.wins
            }
            tone="emerald"
          />

          <FcStatCard
            label="Draws"
            value={
              totals.draws
            }
            tone="slate"
          />
        </section>


        <FcPanel className="overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
              Performance
            </p>

            <h2 className="mt-1 text-xl font-black">
              Leading Entries
            </h2>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {ranked
              .slice(
                0,
                8,
              )
              .map(
                (
                  row,
                  index,
                ) => (
                  <div
                    key={
                      row.registrationId
                    }
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4 sm:grid-cols-[auto_1fr_auto_auto_auto]"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.035] text-xs font-black text-slate-500">
                      {
                        index +
                        1
                      }
                    </span>

                    <p className="truncate font-black">
                      {
                        row.entryName
                      }
                    </p>

                    <p className="text-sm font-black text-sky-300">
                      {
                        row.points
                      } pts
                    </p>

                    <p className="hidden text-xs text-slate-500 sm:block">
                      {
                        row.wins
                      } W
                    </p>

                    <p className="hidden text-xs text-slate-500 sm:block">
                      GD{' '}
                      {row.goalDifference >
                      0
                        ? '+'
                        : ''}
                      {
                        row.goalDifference
                      }
                    </p>
                  </div>
                ),
              )}

            {ranked.length ===
            0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Statistics will appear after confirmed results update the standings.
              </div>
            ) : null}
          </div>
        </FcPanel>


        <FcPanel className="p-5">
          <p className="text-sm leading-6 text-slate-500">
            Individual goal-scorer, assist, rating and Player of the Match leaderboards are not exposed by the current Tournament statistics API, so this page only displays metrics supported by existing data.
          </p>
        </FcPanel>
      </div>
    </AppShell>
  );
}
