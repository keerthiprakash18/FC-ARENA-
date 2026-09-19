'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { CareerNavigation } from '@/components/career/career-navigation';
import {
  FcCrest,
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface LeagueHistory {
  id: string;
  type: string;
  joinedAt: string;

  league: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    region: string | null;
  };
}

interface CareerData {
  profile: {
    fullName: string;
    identity: {
      inGameName: string;
    } | null;
  };

  leagueHistory:
    LeagueHistory[];
}

export default function CareerLeaguesPage() {
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
        label="Loading League History..."
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
          title="League History"
          subtitle="Your FC ARENA League memberships on a dedicated screen."
        />

        <CareerNavigation />

        {career.leagueHistory.length === 0 ? (
          <FcEmptyState
            title="No League history"
            description="Join or create a League to build your community history."
            actionLabel="Open Leagues"
            actionHref="/leagues"
          />
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {career.leagueHistory.map(
              (membership) => (
                <Link
                  key={membership.id}
                  href={`/leagues/${membership.league.id}`}
                  className="group"
                >
                  <FcPanel className="p-5 transition group-hover:border-sky-400/25">
                    <div className="flex items-center gap-4">
                      <FcCrest
                        name={membership.league.name}
                        imageUrl={membership.league.logoUrl}
                      />

                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-black">
                          {membership.league.name}
                        </h2>

                        <p className="mt-1 font-mono text-[10px] text-sky-400">
                          {membership.league.code}
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          {membership.league.region ||
                            'Region not specified'}
                        </p>
                      </div>

                      <FcStatusBadge
                        label={membership.type}
                        tone="cyan"
                      />
                    </div>

                    <p className="mt-4 text-xs text-slate-600">
                      Joined{' '}
                      {new Date(
                        membership.joinedAt,
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
