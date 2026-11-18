import Link from 'next/link';
import { describeSavedPlayoffs, type PlayoffGuideInput } from '@/lib/saved-playoff-explainer';

export function SavedPlayoffExplanation({
  tournament,
  tournamentId,
  stageTotal,
  stageIncomplete,
  bracketFixtures,
}: {
  tournament: PlayoffGuideInput;
  tournamentId: string;
  stageTotal: number;
  stageIncomplete: number;
  bracketFixtures: number;
}) {
  const guide = describeSavedPlayoffs(tournament);
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
      <ol className="grid gap-3 md:grid-cols-3">
        <li className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <span className="text-xs font-bold text-sky-300">01 · QUALIFY</span>
          <p className="mt-2 text-sm leading-6">{guide.qualifierRule}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{guide.selection}</p>
        </li>
        <li className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <span className="text-xs font-bold text-sky-300">02 · PLAYOFF RULE</span>
          <p className="mt-2 text-sm leading-6">{guide.mechanism}</p>
        </li>
        <li className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <span className="text-xs font-bold text-sky-300">03 · THE CHAMPION</span>
          <p className="mt-2 text-sm leading-6">{guide.winnerRule}</p>
        </li>
      </ol>
      {guide.rounds.length > 0 ? (
        <div>
          <h3 className="text-sm font-bold">Route to the trophy — format example</h3>
          <ol className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {guide.rounds.map((round, index) => (
              <li key={round} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true" className="text-amber-300">→</span> : null}
                <span className="rounded-lg border border-white/10 px-3 py-2">{round}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
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
