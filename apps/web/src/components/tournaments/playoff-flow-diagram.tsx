import { Fragment } from 'react';
import { seededOpeningPairs, sampleSeededKnockoutRounds } from '@/lib/playoff-flow-data';
import { describePlayoffVisualRules, type PlayoffVisualRules } from '@/lib/playoff-visual-rules';
import type { PlayoffGuide, PlayoffGuideInput } from '@/lib/saved-playoff-explainer';

/**
 * An illustrative, scrollable diagram of the SAVED tournament rules.
 * Do not pass live entrants: only a generated official bracket can show
 * real pairings. Keep this separate from the live PlayoffBracket component.
 */
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

function DoubleChanceFlow({ qualifierCount, rules }: { qualifierCount: number | null | undefined; rules: PlayoffVisualRules }) {
  const eliteCount = (qualifierCount ?? 0) >= 8 ? 4 : 2;
  return (
    <ol className="flex w-max min-w-full items-stretch gap-1 py-2" aria-label="Double-Chance qualification route">
      <FlowNode eyebrow="Stage" title={rules.stageTitle} detail={rules.stageDetail} />
      <Arrow />
      <FlowNode eyebrow="Qualify" title={rules.qualificationTitle} detail={rules.qualificationDetail} accent="amber" />
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
  const rules = describePlayoffVisualRules(tournament);
  const isDoubleChance = tournament.playoffFormat === 'DOUBLE_CHANCE' &&
    tournament.competitionFormat !== 'UCL_CUP';
  const pairs = !isDoubleChance && rules.seededExamplesAllowed
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
        {isDoubleChance ? <DoubleChanceFlow qualifierCount={count} rules={rules} /> : (
          <ol className="flex w-max min-w-full items-stretch gap-1 py-2" aria-label="Qualification to champion">
            <FlowNode eyebrow={isDirect ? 'Entry list' : 'Stage'}
              title={rules.stageTitle}
              detail={rules.stageDetail} />
            <Arrow />
            <FlowNode eyebrow="Qualify"
              title={rules.qualificationTitle}
              detail={rules.qualificationDetail} accent="amber" />
            {guide.rounds.filter(round => round !== 'Champion').map((round, index) => (
              <Fragment key={round}>
                <Arrow label={index === 0 ? 'advance' : undefined} />
                <FlowNode eyebrow={index === 0 ? 'Opening round' : 'Next round'} title={round}
                  detail={isUcl && index === 0 ? 'Aggregate decides the winner' : 'Verified winner advances'} />
              </Fragment>
            ))}
            <Arrow />
            <FlowNode eyebrow="Official winner" title="🏆 Champion"
              detail="Verified final winner" accent="emerald" />
          </ol>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">↔ Scroll sideways on mobile to view the full progression. {rules.qualificationNote}</p>
      {pairs.length ? (
        <section className="mt-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-secondary-background)] p-3" aria-label="Example seeded knockout bracket">
          <h4 className="text-sm font-bold">Example seed-to-final bracket</h4>
          <p className="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">Each winner advances along the bracket to the next round. Seed placeholders only; no official fixtures have been drawn.</p>
          <div role="region" aria-label="Scrollable seeded knockout example" tabIndex={0}
            className="mt-3 overflow-x-auto rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-focus)]">
            <div className="flex w-max min-w-full items-stretch gap-3 p-1">
              {sampleSeededKnockoutRounds(count ?? 0).map((round, index) => (
                <Fragment key={round.title}>
                  {index > 0 ? <div aria-hidden="true" className="flex w-6 shrink-0 items-center justify-center text-lg text-[var(--theme-primary)]">→</div> : null}
                  <div className="flex w-48 shrink-0 flex-col rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3">
                    <h5 className="border-b border-[var(--theme-border)] pb-2 text-center text-xs font-black text-[var(--theme-text)]">{round.title}</h5>
                    <ol className="flex flex-1 flex-col justify-around gap-3 py-3">
                      {round.matches.map((match) => (
                        <li key={match} className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-2 text-xs leading-5 text-[var(--theme-text)]">
                          {match}
                        </li>
                      ))}
                    </ol>
                  </div>
                </Fragment>
              ))}
              <div aria-hidden="true" className="flex w-6 shrink-0 items-center justify-center text-lg text-[var(--theme-primary)]">→</div>
              <div className="flex w-40 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-primary-soft)] p-4 text-center">
                <span aria-hidden="true" className="text-3xl">🏆</span>
                <strong className="text-sm text-[var(--theme-text)]">Champion</strong>
                <span className="text-xs text-[var(--theme-text-secondary)]">Verified final winner</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      <figcaption className="mt-3 text-xs leading-5 text-slate-400">
        {guide.mechanism} {guide.reminder}
      </figcaption>
    </figure>
  );
}
