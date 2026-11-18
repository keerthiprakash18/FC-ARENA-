import type { PlayoffGuide, PlayoffGuideInput } from '@/lib/saved-playoff-explainer';

/**
 * An illustrative, scrollable diagram of the SAVED tournament rules.
 * Do not pass live entrants: only a generated official bracket can show
 * real pairings. Keep this separate from the live PlayoffBracket component.
 */
export function seededOpeningPairs(count: number): Array<[number, number]> {
  if (![4, 8, 16].includes(count)) return [];
  let branches = [1];
  for (let size = 2; size <= count / 2; size *= 2) {
    branches = branches.flatMap(seed => [seed, size + 1 - seed]);
  }
  return branches.map(seed => [seed, count + 1 - seed]);
}

function FlowNode({ eyebrow, title, detail, accent = 'sky' }: {
  eyebrow: string;
  title: string;
  detail: string;
  accent?: 'sky' | 'amber' | 'emerald';
}) {
  const tone = accent === 'amber'
    ? 'border-amber-400/40 bg-amber-400/10'
    : accent === 'emerald'
      ? 'border-emerald-400/40 bg-emerald-400/10'
      : 'border-sky-400/30 bg-sky-400/[0.06]';
  return (
    <li className={`flex w-44 shrink-0 flex-col justify-center rounded-2xl border p-4 text-center ${tone}`}>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{eyebrow}</span>
      <strong className="mt-1 text-sm font-black">{title}</strong>
      <span className="mt-1 text-xs leading-5 text-slate-400">{detail}</span>
    </li>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <li aria-hidden="true" className="flex w-12 shrink-0 flex-col items-center justify-center gap-1 text-amber-300">
      {label ? <small className="text-center text-[9px] font-bold uppercase text-slate-400">{label}</small> : null}
      <span className="text-xl">→</span>
    </li>
  );
}

function DoubleChanceFlow({ qualifierCount }: { qualifierCount: number | null | undefined }) {
  const eliteCount = (qualifierCount ?? 0) >= 8 ? 4 : 2;
  return (
    <ol className="flex w-max min-w-full items-stretch gap-1 py-2" aria-label="Double-Chance qualification route">
      <FlowNode eyebrow="League table" title={`Top ${qualifierCount ?? 'N'}`} detail="Final verified league ranking" />
      <Arrow label="split" />
      <li className="flex w-48 shrink-0 flex-col gap-2">
        <div className="flex flex-1 flex-col justify-center rounded-xl border border-violet-400/30 bg-violet-400/10 p-3 text-center">
          <strong className="text-xs">Top {eliteCount} seeds</strong>
          <span className="mt-1 text-[11px] leading-4 text-slate-400">Qualifying finals</span>
        </div>
        <div className="flex flex-1 flex-col justify-center rounded-xl border border-sky-400/30 bg-sky-400/10 p-3 text-center">
          <strong className="text-xs">Other qualified seeds</strong>
          <span className="mt-1 text-[11px] leading-4 text-slate-400">Lower-seed elimination path</span>
        </div>
      </li>
      <Arrow />
      <li className="flex w-52 shrink-0 flex-col gap-2">
        <div className="flex flex-1 flex-col justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-center">
          <strong className="text-xs">Qualifying-final winners</strong>
          <span className="mt-1 text-[11px] text-slate-400">Advance to later knockout round</span>
        </div>
        <div className="flex flex-1 flex-col justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-center">
          <strong className="text-xs">Second chance</strong>
          <span className="mt-1 text-[11px] leading-4 text-slate-400">Qualifying-final losers vs lower-path survivors</span>
        </div>
      </li>
      <Arrow label="winners" />
      <FlowNode eyebrow="Knockout" title={eliteCount === 4 ? 'Semi-finals → Final' : 'Final'} detail="Second-chance losers are out" accent="amber" />
      <Arrow />
      <FlowNode eyebrow="Official winner" title="🏆 Champion" detail="Winner of the verified final" accent="emerald" />
    </ol>
  );
}

export function PlayoffFlowDiagram({ guide, tournament }: {
  guide: PlayoffGuide;
  tournament: PlayoffGuideInput;
}) {
  const count = tournament.playoffQualifiersTotal;
  const isDoubleChance = tournament.playoffFormat === 'DOUBLE_CHANCE' &&
    tournament.competitionFormat !== 'UCL_CUP';
  const pairs = !isDoubleChance && tournament.playoffSource === 'OVERALL_STANDINGS' &&
    (tournament.playoffSeedingBasis === 'OVERALL_PERFORMANCE' ||
      tournament.playoffSeedingBasis === 'AUTO' ||
      !tournament.playoffSeedingBasis)
    ? seededOpeningPairs(count ?? 0) : [];
  const isUcl = tournament.competitionFormat === 'UCL_CUP';
  const isDirect = tournament.competitionFormat === 'SINGLE_ELIMINATION';

  return (
    <figure aria-label="Visual playoff progression diagram" className="rounded-2xl border border-white/10 bg-black/10 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black">🏟️ Road to the Trophy</h3>
        <span className="rounded-full border border-amber-400/30 px-3 py-1 text-[11px] font-bold text-amber-300">
          Format illustration · not live fixtures
        </span>
      </div>
      <div role="region" aria-label="Scroll to explore the playoff route" tabIndex={0}
        className="overflow-x-auto rounded-xl bg-white/[0.02] p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
        {isDoubleChance ? <DoubleChanceFlow qualifierCount={count} /> : (
          <ol className="flex w-max min-w-full items-stretch gap-1 py-2" aria-label="Qualification to champion">
            <FlowNode eyebrow={isDirect ? 'Entry list' : 'Stage'}
              title={isDirect ? 'All approved entries' : isUcl ? 'League phase' : 'League / Group Stage'}
              detail={isDirect ? 'Direct knockout' : 'Finish and verify results'} />
            <Arrow />
            <FlowNode eyebrow="Qualify"
              title={isDirect ? 'Knockout draw' : `Top ${count ?? 'configured'} qualify`}
              detail={isDirect ? 'Approved entrants' : 'Based on saved qualification rules'} accent="amber" />
            {guide.rounds.filter(round => round !== 'Champion').map((round, index) => (
              <li key={round} className="contents">
                <Arrow label={index === 0 ? 'advance' : undefined} />
                <FlowNode eyebrow={index === 0 ? 'Opening round' : 'Next round'} title={round}
                  detail={isUcl && index === 0 ? 'Aggregate decides the winner' : 'Verified winner advances'} />
              </li>
            ))}
            <Arrow />
            <FlowNode eyebrow="Official winner" title="🏆 Champion"
              detail="Verified final winner" accent="emerald" />
          </ol>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">↔ Scroll sideways on mobile to view the full progression.</p>
      {pairs.length ? (
        <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/[0.03] p-3">
          <h4 className="text-sm font-bold">Example opening matches · Seed numbers only</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {pairs.map(([higher, lower], index) => (
              <div key={higher} className="rounded-lg border border-white/10 p-2 text-center text-xs font-bold">
                <span className="block text-[10px] text-slate-400">Match {index + 1}</span>
                #{higher} <span className="text-amber-300">vs</span> #{lower}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">These are seed placeholders, not confirmed teams. The real bracket appears after generation.</p>
        </div>
      ) : null}
      <figcaption className="mt-3 text-xs leading-5 text-slate-400">
        {guide.mechanism} {guide.reminder}
      </figcaption>
    </figure>
  );
}
