'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app/app-shell';
import { EliteCupFormatCard } from '@/components/elite-cup/elite-cup-format-card';
import {
  FcActionRow,
  FcCrest,
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcSectionHeading,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';
import {
  getEliteCupFormatDefinition,
  getEliteCupRecommendedFormat,
  savedEliteCupFormatMatchesRecommendation,
} from '@/lib/elite-cup-format';

interface Membership {
  league: { id: string; name: string; code: string };
}

interface UclCupTournament {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  description?: string | null;
  competitionFormat?: string | null;
  status: string;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
  league?: { id: string; name: string; code: string };
}

const destinations = [
  ['Fixtures', 'Review the official league-phase schedule.', 'fixtures', 'fixtures', 'cyan'],
  ['Standings', 'Follow the UCL league table and qualification places.', 'chart', 'standings', 'emerald'],
  ['Rankings', 'Open UCL Cup player rankings.', 'trophy', 'rankings', 'gold'],
  ['Stats', 'Explore UCL Cup performance data.', 'activity', 'stats', 'amber'],
  ['Playoffs', 'Open the qualification and knockout bracket.', 'bracket', 'playoffs', 'cyan'],
  ['Registration', 'Review tournament registration details.', 'clipboard', 'registration', 'slate'],
] as const;

function statusTone(status: string) {
  if (status === 'COMPLETED') return 'emerald' as const;
  if (status === 'CANCELLED') return 'red' as const;
  if (status === 'DRAFT') return 'amber' as const;
  return 'cyan' as const;
}

export default function UclCupHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tournaments, setTournaments] = useState<UclCupTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [currentUser, membershipResponse] = await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{ data: { leagues: Membership[] } }>('/leagues/my'),
        ]);

        const leagueTournaments = await Promise.all(
          membershipResponse.data.leagues.map(async (membership) => {
            const response = await authenticatedRequest<{ data: { tournaments: UclCupTournament[] } }>(
              `/leagues/${membership.league.id}/tournaments`,
            );
            return response.data.tournaments.map((tournament) => ({
              ...tournament,
              league: tournament.league ?? membership.league,
            }));
          }),
        );

        const unique = new Map<string, UclCupTournament>();
        for (const tournament of leagueTournaments.flat()) {
          if (tournament.competitionFormat === 'UCL_CUP') unique.set(tournament.id, tournament);
        }

        setUser(currentUser);
        setTournaments([...unique.values()]);
      } catch {
        setError('Unable to load UCL Cup tournaments. Please retry.');
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  const approvedTeams = useMemo(
    () => tournaments.reduce((total, tournament) => total + (tournament.approvedEntries || 0), 0),
    [tournaments],
  );
  const recommendation = getEliteCupFormatDefinition(getEliteCupRecommendedFormat(approvedTeams));

  if (loading || !user) return <FcLoadingScreen label="Loading UCL Cup..." />;

  if (error) {
    return <AppShell playerName={user.player?.identity?.inGameName}><FcErrorState message={error} onRetry={() => window.location.reload()} /></AppShell>;
  }

  return (
    <AppShell playerName={user.player?.identity?.inGameName}>
      <div className="space-y-7">
        <FcPageHeader
          eyebrow="FC ARENA competition hub"
          title="UCL Cup"
          subtitle="A Champions League-style league phase, qualification path and knockout finish for FC ARENA competitions."
          action={<Link href="/tournaments" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-black text-slate-300 hover:border-sky-400/30 hover:text-sky-300">All Tournaments →</Link>}
        />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="UCL Cup overview">
          <FcStatCard label="Approved teams" value={approvedTeams} detail="Across the visible UCL Cup field" />
          <FcStatCard label="UCL Cups" value={tournaments.length} detail="Tournaments tagged UCL_CUP" tone="gold" />
          <FcStatCard label="League phase" value={recommendation.shortLabel} detail="Automatic schedule guidance" tone="amber" />
          <FcStatCard label="Qualification" value="Playoffs" detail="League table feeds the bracket" tone="emerald" />
        </section>

        <EliteCupFormatCard approvedTeams={approvedTeams} competitionName="UCL Cup" title="UCL Cup competition format" />

        <section>
          <FcSectionHeading eyebrow="Saved competitions" title="UCL Cup tournaments" action={<span className="text-xs font-black text-slate-600">{tournaments.length} tournament{tournaments.length === 1 ? '' : 's'}</span>} />
          {tournaments.length === 0 ? (
            <div className="mt-4"><FcEmptyState title="No UCL Cup tournaments yet" description="Create a tournament with the UCL Cup format and it will appear here with its dedicated branding." actionLabel="Open Tournaments" actionHref="/tournaments" /></div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {tournaments.map((tournament) => (
                <FcPanel key={tournament.id} className="overflow-hidden">
                  <div className="border-b border-white/[0.07] bg-[linear-gradient(120deg,rgba(43,186,255,0.10),transparent_65%)] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <FcCrest name={tournament.name} imageUrl={tournament.logoUrl || '/branding/ucl-cup.svg'} size="lg" />
                        <div className="min-w-0"><p className="font-mono text-[10px] text-sky-400">{tournament.code}</p><h3 className="mt-1 truncate text-xl font-black text-white">{tournament.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{tournament.league?.name ?? 'League tournament'}</p></div>
                      </div>
                      <FcStatusBadge label={tournament.status} tone={statusTone(tournament.status)} />
                    </div>
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Approved</p><p className="mt-1 text-lg font-black text-slate-200">{tournament.approvedEntries}</p></div>
                      <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Format</p><p className="mt-1 text-xs font-black text-slate-200">UCL Cup</p></div>
                      <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Start</p><p className="mt-1 text-xs font-black text-slate-200">{tournament.startAt ? new Date(tournament.startAt).toLocaleDateString() : 'TBD'}</p></div>
                    </div>
                    {!savedEliteCupFormatMatchesRecommendation(tournament.competitionFormat, tournament.approvedEntries) ? <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-200">Saved format differs from the current team-count recommendation.</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2"><Link href={`/ucl-cup/${tournament.id}`} className="inline-flex min-h-10 items-center rounded-xl bg-sky-400 px-4 py-2 text-sm font-black text-[#031019]">Open UCL Cup</Link><Link href={`/tournaments/${tournament.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-slate-300">Tournament Overview</Link></div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">{destinations.map(([label, description, icon, suffix, tone]) => <FcActionRow key={label} href={`/tournaments/${tournament.id}/${suffix}`} icon={icon} title={label} description={description} tone={tone} />)}</div>
                  </div>
                </FcPanel>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
