import type { QualificationBand, TournamentFormatDescription } from '@/lib/tournament-format-guide';
import { TournamentFormatPreview } from './tournament-format-preview';

export function QualificationLegend({ bands }: { bands: QualificationBand[] }) {
  if (!bands.length) return null;
  return <div className="fc-qualification-legend" aria-label="Qualification places">
    {bands.map(band => <span key={band.from} data-qualification={band.tone}>
      <b>{band.from === band.to ? band.from : `${band.from}–${band.to}`}</b> {band.label}
    </span>)}
  </div>;
}

export function TournamentFormatGuide({ guide, compact = false }: { guide?: TournamentFormatDescription | null; compact?: boolean }) {
  if (!guide) return null;
  const q = guide.qualification;
  const content = <section className="fc-format-guide" aria-label="Tournament format and qualification">
    <header><div><p className="fc-format-eyebrow">Format &amp; qualification</p><h2>{guide.title}</h2></div>
      <span className="fc-format-status">{q.state === 'PENDING' ? 'Setup pending' : 'Tournament rules'}</span>
    </header>
    <dl className="fc-format-facts">
      <div><dt>Approved {guide.entryLabel}</dt><dd>{guide.approvedEntries} <small>/ {guide.capacity} places</small></dd></div>
      <div><dt>Entry type</dt><dd>{guide.mode === 'SOLO' ? 'Individual' : guide.mode === 'DUO' ? 'Duo' : 'Team'}{guide.mode !== 'SOLO' ? <small> · {guide.teamSize} players per entry</small> : null}</dd></div>
      <div><dt>{q.state === 'NONE' ? 'Progression' : 'Knockout places'}</dt><dd>{q.state === 'NONE' ? 'See format below' : q.state === 'PENDING' ? 'Not finalised' : q.total}</dd></div>
    </dl>
    <TournamentFormatPreview guide={guide} />
    <div className="fc-format-qualification"><h3>{q.source === 'GROUP_QUALIFIERS' ? 'Who advances from each group?' : 'How do entries progress?'}</h3><p>{q.description}</p>
      {q.source !== 'GROUP_QUALIFIERS' ? <QualificationLegend bands={q.bands} /> : null}
      {q.state === 'READY' && guide.provisional && q.source !== 'DIRECT_ENTRIES' ? <p className="fc-format-muted">These are qualification places. Final qualifiers are decided after the stage results are confirmed.</p> : null}
    </div>
    <p className="fc-format-path">{guide.stage}</p>
    <p>{guide.fixtureRule}</p>
    {guide.groups.length > 1 ? <ul className="fc-format-groups" aria-label="Approved entries per group">{guide.groups.map((group, i) => <li key={i}>{group.name}: <b>{group.entries} {guide.entryLabel}</b>{q.perGroup ? ` · ${q.perGroup} qualifying places` : ''}</li>)}</ul> : null}
    {guide.note ? <p className="fc-format-notice" role="note">{guide.note}</p> : null}
    {guide.scoring || guide.ranking || guide.knockoutRule ? <details className="fc-format-rules"><summary>Scoring, tie-breaks &amp; knockout rules</summary><div>{[guide.scoring, guide.ranking, guide.knockoutRule].filter(Boolean).map(rule => <p key={rule}>{rule}</p>)}</div></details> : null}
  </section>;
  return compact ? <details className="fc-format-disclosure"><summary>Tournament format &amp; qualification</summary>{content}</details> : content;
}
