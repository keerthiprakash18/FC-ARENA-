import Link from 'next/link';
import { hasKnockoutStage } from '@/lib/tournament-ui-context';

export interface OverviewFormatInfo {
  competitionFormat?: string | null;
  groupMode?: string | null;
  approvedEntries: number;
  playoffSource?: string | null;
  playoffQualifiersTotal?: number | null;
  qualifiersPerGroup?: number | null;
  playoffFormat?: string | null;
}

const playoffNames: Record<string, string> = {
  GLOBAL_SEEDED: 'Global Seeded Knockout',
  PROTECTED_SEED: 'Protected Seed Knockout',
  DOUBLE_CHANCE: 'Double-Chance Playoffs',
};

export function TournamentFormatOverview({
  tournament,
  groupCount,
  tournamentId,
}: {
  tournament: OverviewFormatInfo;
  groupCount: number | null;
  tournamentId: string;
}) {
  const format = tournament.competitionFormat ?? '';
  const knockout = hasKnockoutStage(format);
  const noGroups = groupCount === 0;
  const leagueStage = format === 'GROUP_STAGE_KNOCKOUT' &&
    (noGroups || (tournament.groupMode === 'SINGLE_GROUP' && tournament.playoffSource === 'OVERALL_STANDINGS'));
  const roundRobin = format === 'LEAGUE_ROUND_ROBIN' || format === 'DOUBLE_ROUND_ROBIN';
  const mode = format === 'DOUBLE_ROUND_ROBIN' ? 'Home & Away League'
    : format === 'LEAGUE_ROUND_ROBIN' ? 'Single-Table League'
    : leagueStage ? 'Single-Table League + Playoffs'
    : format === 'GROUP_STAGE_KNOCKOUT' ? 'Group Stage + Knockout'
    : format === 'SINGLE_ELIMINATION' ? 'Direct Knockout'
    : format === 'UCL_CUP' ? 'UCL League Phase + Knockout'
    : format === 'ELITE_CUP' ? 'Elite Cup League + Knockout'
    : format === 'CUSTOM_MANUAL' ? 'Custom Tournament' : 'Tournament setup';

  const source = tournament.playoffSource ?? 'AUTO';
  const qualifiers = tournament.playoffQualifiersTotal;
  const perGroup = tournament.qualifiersPerGroup;
  const route = format === 'SINGLE_ELIMINATION'
    ? 'All approved entries play knockout matches.'
    : !knockout
      ? roundRobin ? 'Every team plays league matches. First in the final table wins.' : 'Organiser-defined tournament progression.'
      : leagueStage || source === 'OVERALL_STANDINGS'
        ? `Final league standings → top ${qualifiers ?? 'configured'} teams qualify → knockout final decides the champion.`
        : source === 'GROUP_QUALIFIERS'
          ? `Group standings → ${perGroup ? `top ${perGroup} from each group` : 'qualified teams'} → knockout champion.`
          : 'Complete the stage and follow the published qualification settings.';

  const playoff = !knockout ? 'No Playoffs — League Winner'
    : format === 'UCL_CUP' ? 'UCL Two-Leg Knockout'
    : playoffNames[tournament.playoffFormat ?? ''] ?? 'Knockout Bracket';

  const playoffDescription = !knockout
    ? 'The team finishing first in the final league table is the tournament winner.'
    : leagueStage
      ? `After every league match is verified, the top ${qualifiers ?? 'configured'} qualify. The saved ${playoff} determines the champion; finishing first in the league alone is not enough.`
      : 'The knockout final determines the tournament champion.';

  return (
    <section aria-label="Tournament and playoff formats" className="grid gap-4 md:grid-cols-2">
      <div className="theme-panel rounded-2xl border p-5">
        <p className="text-xs font-black uppercase tracking-widest text-sky-400">Tournament Format</p>
        <h2 className="mt-2 text-xl font-black">{mode}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{route}</p>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          {tournament.approvedEntries} approved entries
          {groupCount !== null ? ` · ${groupCount > 0 ? `${groupCount} groups` : format === 'SINGLE_ELIMINATION' ? 'Direct knockout' : 'One overall table'}` : ''}
        </p>
      </div>
      <div className="theme-panel rounded-2xl border p-5">
        <p className="text-xs font-black uppercase tracking-widest text-amber-400">Playoff Format</p>
        <h2 className="mt-2 text-xl font-black">{playoff}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{playoffDescription}</p>
        {knockout && (
          <Link href={`/tournaments/${tournamentId}/playoffs`} className="mt-3 inline-flex min-h-9 items-center text-sm font-black text-amber-400 underline underline-offset-4">
            See How This Playoff Works →
          </Link>
        )}
      </div>
    </section>
  );
}
