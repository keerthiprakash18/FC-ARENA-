import Link from 'next/link';
import { PlayoffFlowDiagram } from './playoff-flow-diagram';
import { describeSavedPlayoffs, type PlayoffGuideInput } from '@/lib/saved-playoff-explainer';

export function SavedPlayoffExplanation({
  tournament,
  tournamentId,
  stageTotal,
  stageIncomplete,
  bracketFixtures,
  groupCount = null,
}: {
  tournament: PlayoffGuideInput;
  tournamentId: string;
  stageTotal: number;
  stageIncomplete: number;
  bracketFixtures: number;
  groupCount?: number | null;
}) {
  const settings = { ...tournament, groupCount };
  const guide = describeSavedPlayoffs(settings);
  return (
    <section aria-label="How your saved playoff format works" className="theme-panel space-y-4 rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">Your saved format explained</p>
          <h2 className="mt-1 text-xl font-black">{guide.formatName} — how it works</h2>
        </div>
        <span className="rounded-lg border border-amber-300/30 px-3 py-1 text-xs font-bold text-amber-200">
          {bracketFixtures ? 'Bracket published' : stageIncomplete || !stageTotal ? 'League / group stage in progress' : 'Stage finished · bracket not yet published'}
        </span>
      </div>
      <PlayoffFlowDiagram guide={guide} tournament={settings} />
      <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3 text-sm font-semibold text-emerald-300">
        🏆 {guide.winnerRule}
      </p>
      {guide.isLeaguePlayoffs ? (
        <p className="text-sm font-semibold text-emerald-300">
          League progress: {stageTotal - stageIncomplete}/{stageTotal} stage fixtures completed.
          {bracketFixtures ? ' The knockout bracket is available below.' : ' Bracket creation unlocks after the stage is finished and verified.'}
        </p>
      ) : null}
      <p className="text-xs leading-5 text-slate-400">{guide.reminder}</p>
      <div className="flex flex-wrap gap-3 text-sm font-bold">
        <Link href={`/tournaments/${tournamentId}/standings`} className="text-sky-300 underline underline-offset-4">View official standings</Link>
        <Link href={`/tournaments/${tournamentId}/achievements`} className="text-amber-300 underline underline-offset-4">Awards &amp; DUO team honours →</Link>
      </div>
    </section>
  );
}
