'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { CareerNavigation } from '@/components/career/career-navigation';
import {
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
} from '@/components/fc/fc-ui';

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

  tournament: {
    id: string;
    name: string;
    code: string;
  };
}

interface CareerData {
  profile: {
    fullName: string;
    identity: {
      inGameName: string;
    } | null;
  };

  achievements:
    Achievement[];
}

function achievementIcon(type: string) {
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

export default function CareerAchievementsPage() {
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [career, setCareer] =
    useState<CareerData | null>(null);

  useEffect(() => {
    void (async () => {
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
    })();
  }, []);

  if (!user || !career) {
    return (
      <FcLoadingScreen
        label="Loading Achievements..."
      />
    );
  }

  const playerName =
    career.profile.identity
      ?.inGameName ||
    career.profile.fullName;

  return (
    <AppShell playerName={playerName}>
      <div className="space-y-6">
        <BackHeader
          backHref="/career"
          backLabel="Career Stats"
          eyebrow="Player Career"
          title="Achievements"
          subtitle="Trophies, awards and milestones in one focused collection."
        />

        <CareerNavigation />

        {career.achievements.length === 0 ? (
          <FcEmptyState
            title="No achievements yet"
            description="Tournament awards and milestones will appear here after they are generated."
            actionLabel="Open Tournaments"
            actionHref="/tournaments"
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {career.achievements.map(
              (achievement) => (
                <Link
                  key={achievement.id}
                  href={`/tournaments/${achievement.tournament.id}/achievements`}
                  className="group"
                >
                  <FcPanel className="h-full border-amber-400/15 p-5 transition group-hover:border-amber-400/30">
                    <p className="text-3xl">
                      {achievementIcon(
                        achievement.type,
                      )}
                    </p>

                    <h2 className="mt-4 text-lg font-black">
                      {achievement.title}
                    </h2>

                    <p className="mt-2 text-sm font-black text-sky-300">
                      {achievement.tournament.name}
                    </p>

                    {achievement.description ? (
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        {achievement.description}
                      </p>
                    ) : null}

                    <p className="mt-4 text-xs text-slate-600">
                      {new Date(
                        achievement.awardedAt,
                      ).toLocaleDateString()}
                    </p>
                  </FcPanel>
                </Link>
              ),
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
