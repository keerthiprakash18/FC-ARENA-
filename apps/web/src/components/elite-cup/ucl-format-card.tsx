import { FcPanel, FcStatusBadge } from '@/components/fc/fc-ui';
import { getUclQualification } from '@/lib/ucl-format';

export function UclFormatCard({ approvedTeams, className = '' }: { approvedTeams: number; className?: string }) {
  const count = Math.max(0, Math.floor(approvedTeams));
  const ready = count >= 2;
  const referenceCount = ready ? count : 36;
  const qualification = getUclQualification(referenceCount);
  const standard = count === 36;
  return <FcPanel className={`overflow-hidden p-5 sm:p-6 ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-wider text-sky-400">UCL competition format</p>
        <h2 className="mt-2 text-xl font-black">League phase → knockout play-offs → final</h2></div>
      <FcStatusBadge label={!ready ? 'Awaiting teams' : standard ? '36-team format' : 'Adapted team count'} tone="cyan" />
    </div>
    <p className="mt-3 text-sm leading-6 text-slate-400">The Champions League format uses 36 teams in one table. Each plays eight different opponents, four home and four away. The top eight advance directly, places 9–24 enter knockout play-offs, and places 25–36 are eliminated.</p>
    <ol className="mt-5 grid gap-3 sm:grid-cols-3">
      <li className="rounded-xl border border-white/10 p-4"><strong className="block text-sky-300">1 · League phase</strong><p className="mt-2 text-sm text-slate-400">{referenceCount} teams · {Math.min(8, referenceCount - 1)} opponents per team. Seed order forms the pots for the 36-team draw.</p></li>
      <li className="rounded-xl border border-white/10 p-4"><strong className="block text-sky-300">2 · Qualification</strong><p className="mt-2 text-sm text-slate-400">Top {qualification.direct} go directly to the {qualification.knockoutSize}-team bracket.{qualification.qualifiers > qualification.direct ? ` Places ${qualification.direct + 1}–${qualification.qualifiers} play qualifying ties.` : ''}{count > qualification.qualifiers ? ` Places ${qualification.qualifiers + 1}–${count} are eliminated.` : ''}</p></li>
      <li className="rounded-xl border border-white/10 p-4"><strong className="block text-sky-300">3 · Knockout</strong><p className="mt-2 text-sm text-slate-400">Two legs per tie, then a single final. Aggregate goals decide the winner; tied aggregates need a penalty shoot-out. No away-goals rule.</p></li>
    </ol>
    {!ready ? <p className="mt-4 text-xs leading-5 text-amber-200">{count} approved {count === 1 ? 'team' : 'teams'} so far. Approve at least two teams to prepare an adapted competition, or 36 teams for the standard format shown above.</p>
      : !standard ? <p className="mt-4 text-xs leading-5 text-amber-200">This field uses the same competition structure with qualification adapted to its size. Add 36 approved teams for the standard 8 / 16 / 12 qualification split.</p> : null}
    <p className="mt-3 text-xs leading-5 text-slate-500">League ranking uses points, goal difference, goals, away goals, wins, away wins and opponents’ results. Remaining ties use tournament seed order. UEFA club coefficients and association restrictions do not apply to custom FC ARENA teams.</p>
    <a href="https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-19-Draw-system-knockout-phase-Online" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-bold text-sky-300">UEFA knockout format reference ↗</a>
  </FcPanel>;
}
