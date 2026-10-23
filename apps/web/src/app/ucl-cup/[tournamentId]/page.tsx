'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app/app-shell';
import { EliteCupFormatCard } from '@/components/elite-cup/elite-cup-format-card';
import { FcActionRow, FcCrest, FcEmptyState, FcLoadingScreen, FcPageHeader, FcPanel, FcStatCard, FcStatusBadge } from '@/components/fc/fc-ui';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';

interface UclCupTournament {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  logoUrl?: string | null;
  competitionFormat?: string | null;
  status: string;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
  league?: { id: string; name: string; code: string };
}

const destinations = [
  ['Fixtures', 'Review the official league-phase schedule.', 'fixtures', 'cyan'],
  ['Standings', 'Follow the league table and qualification places.', 'standings', 'emerald'],
  ['Rankings', 'Open UCL Cup player rankings.', 'rankings', 'gold'],
  ['Stats', 'Explore UCL Cup performance data.', 'stats', 'amber'],
  ['Playoffs', 'Open the qualification and knockout bracket.', 'playoffs', 'cyan'],
  ['Registration', 'Review tournament registration details.', 'registration', 'slate'],
] as const;

export default function UclCupTournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tournament, setTournament] = useState<UclCupTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [currentUser, response] = await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{ data: { tournament: UclCupTournament } }>(`/tournaments/${tournamentId}`),
        ]);
        setUser(currentUser);
        setTournament(response.data.tournament);
      } catch {
        setError('Unable to load this UCL Cup tournament. Please retry.');
        router.replace('/ucl-cup');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router, tournamentId]);

  if (loading || !user) return <FcLoadingScreen label="Loading UCL Cup tournament..." />;
  if (!tournament || tournament.competitionFormat !== 'UCL_CUP') {
    return <AppShell playerName={user.player?.identity?.inGameName}><FcEmptyState title="UCL Cup tournament unavailable" description={error || 'This route is reserved for UCL Cup tournaments.'} actionLabel="Back to UCL Cup" actionHref="/ucl-cup" /></AppShell>;
  }

  const basePath = `/tournaments/${tournament.id}`;
  return (
    <AppShell playerName={user.player?.identity?.inGameName}>
      <div className="space-y-7">
        <Link href="/ucl-cup" className="inline-flex text-sm font-black text-slate-500 hover:text-sky-300">← UCL Cup hub</Link>
        <FcPageHeader eyebrow={tournament.league?.name ?? 'UCL Cup'} title={tournament.name} subtitle={tournament.description || 'A Champions League-style FC ARENA competition with a league phase and playoff finish.'} action={<Link href={basePath} className="inline-flex min-h-11 items-center rounded-xl bg-sky-400 px-4 text-sm font-black text-[#031019]">Existing Overview →</Link>} />
        <FcPanel className="overflow-hidden"><div className="flex flex-col gap-5 border-b border-white/[0.07] bg-[linear-gradient(120deg,rgba(43,186,255,0.10),transparent_65%)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-center gap-4"><FcCrest name={tournament.name} imageUrl={tournament.logoUrl || '/branding/ucl-cup.svg'} size="lg" /><div><p className="font-mono text-[10px] text-sky-400">{tournament.code}</p><div className="mt-2 flex flex-wrap gap-2"><FcStatusBadge label="UCL_CUP" tone="gold" /><FcStatusBadge label={tournament.status} tone="cyan" />{tournament.startAt ? <FcStatusBadge label={new Date(tournament.startAt).toLocaleDateString()} tone="slate" /> : null}</div></div></div><p className="text-sm font-black text-slate-400">{tournament.approvedEntries} approved / {tournament.maxEntries} capacity</p></div></FcPanel>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="UCL Cup tournament summary"><FcStatCard label="Approved teams" value={tournament.approvedEntries} detail={`Maximum ${tournament.maxEntries}`} /><FcStatCard label="League phase" value="Active" detail="Combined UCL table" tone="gold" /><FcStatCard label="Registration" value={tournament.status} detail="Current tournament state" tone="emerald" /><FcStatCard label="Competition" value="UCL Cup" detail="League phase + playoffs" tone="amber" /></section>
        <EliteCupFormatCard approvedTeams={tournament.approvedEntries} savedFormat={tournament.competitionFormat} competitionName="UCL Cup" title="UCL Cup format guide" />
        <section><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-medium text-slate-500">Canonical tournament destinations</p><h2 className="mt-1 text-xl font-black text-white">Open the UCL Cup views</h2></div><Link href={basePath} className="text-sm font-black text-sky-300">Tournament overview →</Link></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{destinations.map(([label, description, suffix, tone]) => <FcActionRow key={label} href={`${basePath}/${suffix}`} icon={label === 'Fixtures' ? 'fixtures' : label === 'Standings' ? 'chart' : label === 'Stats' ? 'activity' : label === 'Registration' ? 'clipboard' : label === 'Rankings' ? 'trophy' : 'bracket'} title={label} description={description} tone={tone} />)}</div></section>
      </div>
    </AppShell>
  );
}
