'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { LeagueExplorer } from '@/components/leagues/league-explorer';
import { FcLoadingScreen } from '@/components/fc/fc-ui';
import { getCurrentUser, type CurrentUser } from '@/lib/auth-client';

export default function ExploreLeaguesPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    void getCurrentUser().then(setUser).catch(() => router.replace('/login'));
  }, [router]);

  if (!user) return <FcLoadingScreen label="Loading Explore Leagues..." />;
  return <AppShell playerName={user.player?.identity?.inGameName || user.fullName}><div className="space-y-6"><BackHeader backHref="/leagues" backLabel="My Leagues" eyebrow="Community Directory" title="Explore Leagues" subtitle="Discover public FC ARENA leagues, see their activity, and request to join." /><LeagueExplorer /><div><Link href="/leagues" className="text-sm font-black text-sky-300">← Back to My Leagues</Link></div></div></AppShell>;
}
