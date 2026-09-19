'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { CareerNavigation } from '@/components/career/career-navigation';
import {
  FcCrest,
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface CareerData {
  profile: {
    fullName: string;
    playerCode: string | null;
    profileImageUrl: string | null;
    identity: {
      inGameName: string;
      isVerified: boolean;
    } | null;
    primaryLeague: {
      league: {
        id: string;
        name: string;
      };
    } | null;
    secondaryLeague: {
      league: {
        id: string;
        name: string;
      };
    } | null;
  };

  lifetimeStatistics: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    winRate: number;
    form: string[];
    tournaments: number;
    achievements: number;
  };

  matchHistory: unknown[];
  tournamentHistory: unknown[];
  leagueHistory: unknown[];
  achievements: unknown[];
}

function outcomeClass(outcome: string) {
  if (outcome === 'W') {
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  }

  if (outcome === 'D') {
    return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
  }

  return 'border-red-400/20 bg-red-400/10 text-red-300';
}

export default function CareerPage() {
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [career, setCareer] =
    useState<CareerData | null>(null);

  const [error, setError] =
    useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [current, response] =
          await Promise.all([
            getCurrentUser(),
            authenticatedRequest<{
              success: true;
              data: CareerData;
              error: null;
            }>('/players/me/career'),
          ]);

        setUser(current);
        setCareer(response.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Player Career.',
        );
      }
    })();
  }, []);

  if (!user || !career) {
    return (
      <FcLoadingScreen
        label={
          error ||
          'Loading Career Stats...'
        }
      />
    );
  }

  const stats =
    career.lifetimeStatistics;

  const ign =
    career.profile.identity
      ?.inGameName ||
    career.profile.fullName;

  return (
    <AppShell playerName={ign}>
      <div className="space-y-6">
        <BackHeader
          backHref="/more"
          backLabel="More"
          eyebrow="Player"
          title="Career Stats"
          subtitle="Your career summary only. Match history, tournaments, Leagues and achievements now have dedicated screens."
          action={
            career.profile.identity
              ?.isVerified ? (
              <FcStatusBadge
                label="Verified"
                tone="emerald"
              />
            ) : null
          }
        />

        <CareerNavigation />

        <FcPanel className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <FcCrest
              name={ign}
              imageUrl={
                career.profile
                  .profileImageUrl
              }
              size="lg"
            />

            <div className="min-w-0">
              <h2 className="truncate text-2xl font-black">
                {ign}
              </h2>

              <p className="mt-1 font-mono text-xs text-sky-400">
                {career.profile.playerCode ||
                  'FC ARENA ID pending'}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {career.profile.primaryLeague ? (
                  <Link
                    href={`/leagues/${career.profile.primaryLeague.league.id}`}
                    className="rounded-full border border-sky-400/20 bg-sky-400/[0.05] px-3 py-1 text-[10px] font-black text-sky-300"
                  >
                    {career.profile.primaryLeague.league.name}
                  </Link>
                ) : null}

                {career.profile.secondaryLeague ? (
                  <Link
                    href={`/leagues/${career.profile.secondaryLeague.league.id}`}
                    className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-slate-400"
                  >
                    {career.profile.secondaryLeague.league.name}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </FcPanel>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FcStatCard
            label="Matches"
            value={stats.matches}
            detail={`${stats.wins} wins · ${stats.draws} draws`}
          />

          <FcStatCard
            label="Win Rate"
            value={`${stats.winRate}%`}
            detail={`${stats.losses} losses`}
            tone="emerald"
          />

          <FcStatCard
            label="Goals"
            value={stats.goalsFor}
            detail={`GA ${stats.goalsAgainst} · GD ${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}`}
            tone="amber"
          />

          <FcStatCard
            label="Achievements"
            value={stats.achievements}
            detail={`${stats.tournaments} tournaments`}
            tone="slate"
          />
        </section>

        <FcPanel className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
            Recent Form
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {stats.form.length > 0 ? (
              stats.form.map(
                (result, index) => (
                  <span
                    key={`${result}-${index}`}
                    className={`grid h-10 w-10 place-items-center rounded-xl border font-black ${outcomeClass(result)}`}
                  >
                    {result}
                  </span>
                ),
              )
            ) : (
              <p className="text-sm text-slate-600">
                No completed matches yet.
              </p>
            )}
          </div>
        </FcPanel>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              'Match History',
              'Verified match-by-match results',
              '/career/matches',
            ],
            [
              'Tournament History',
              'Competition-by-competition performance',
              '/career/tournaments',
            ],
            [
              'League History',
              'Current and historical memberships',
              '/career/leagues',
            ],
            [
              'Achievements',
              'Trophies, awards and milestones',
              '/career/achievements',
            ],
          ].map(
            ([title, description, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl border border-white/10 bg-[#08111b] p-4 transition hover:border-sky-400/30"
              >
                <p className="font-black">
                  {title}
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {description}
                </p>

                <span className="mt-3 inline-flex text-xs font-black text-sky-300">
                  Open →
                </span>
              </Link>
            ),
          )}
        </section>
      </div>
    </AppShell>
  );
}
