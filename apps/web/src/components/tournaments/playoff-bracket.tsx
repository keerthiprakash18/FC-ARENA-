'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FcIcon } from '@/components/fc/fc-icons';
import { FcCrest } from '@/components/fc/fc-ui';
import { BRACKET_CARD, bracketEntryName, buildPlayoffBracket, layoutPlayoffBracket } from '@/lib/playoff-bracket';
import type { BracketTie } from '@/lib/playoff-bracket';
import type { FixtureForUi } from './fixture-card';
import styles from './playoff-bracket.module.css';

export function PlayoffBracket({ fixtures, tournamentName, format, readOnly = false }: {
  fixtures: FixtureForUi[]; tournamentName: string; format?: string; readOnly?: boolean;
}) {
  const graph = useMemo(() => layoutPlayoffBracket(buildPlayoffBracket(fixtures)), [fixtures]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const selected = graph.nodes.find(node => node.id === selectedId);
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const active = new Set<string>();
  if (selected) {
    active.add(selected.id);
    // Trace ancestors and descendants separately, so sibling branches stay distinct.
    for (const direction of ['from', 'to'] as const) {
      const queue = [selected.id], seen = new Set(queue);
      while (queue.length) {
        const id = queue.shift()!;
        for (const edge of graph.edges) if (edge[direction === 'from' ? 'to' : 'from'] === id) {
          const next = edge[direction];
          if (!seen.has(next)) { seen.add(next); active.add(next); queue.push(next); }
        }
      }
    }
  }
  const champion = graph.nodes.find(node => node.id === graph.finalId);
  const winner = champion?.winnerId ? (champion.home?.id === champion.winnerId ? champion.home : champion.away) : null;
  if (!graph.nodes.length) return null;

  function fit() {
    const available = viewport.current?.clientWidth ?? graph.width;
    setZoom(Math.max(.15, Math.min(1, (available - 16) / graph.width)));
    viewport.current?.scrollTo({ left: 0, top: 0 });
  }

  return (
    <section className={styles.bracket} aria-label="Tournament championship bracket" data-bracket-layout={graph.mirrored ? 'mirrored' : 'progression'}>
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>Playoff bracket</p><h3>{tournamentName}</h3>
          <p>{format === 'UCL_CUP' ? 'Two legs · aggregate winner advances · single-match final' : format === 'DOUBLE_CHANCE' ? 'Qualifying, elimination and second-chance paths' : 'Follow every tie from qualification to the final'}</p></div>
        {winner ? <div className={styles.trophy}><FcIcon name="trophy" size={42} /><span>Champion</span><strong>{bracketEntryName(winner)}</strong></div> : null}
      </div>
      <div className={styles.toolbar}>
        <div className={styles.legend}><span><i />Winner advances</span>{graph.edges.some(edge => edge.outcome === 'LOSER') ? <span><i className={styles.loserKey} />Second chance</span> : null}<span><FcIcon name="check" size={13} />Verified scores</span></div>
        <div className={styles.controls} aria-label="Bracket zoom controls">
          <button type="button" onClick={() => setZoom(value => Math.max(.15, +(value - .15).toFixed(2)))} aria-label="Zoom out" disabled={zoom <= .15}>−</button>
          <output aria-label="Bracket zoom">{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => setZoom(value => Math.min(1.5, +(value + .15).toFixed(2)))} aria-label="Zoom in" disabled={zoom >= 1.5}>+</button>
          <button type="button" onClick={fit}>Fit bracket</button><button type="button" onClick={() => setZoom(1)}>Reset</button>
        </div>
      </div>
      <p className={styles.hint}>Select a tie to highlight its path and open match details.</p>
      <div ref={viewport} className={styles.viewport} tabIndex={0} role="region" aria-label="Interactive playoff bracket">
        <div style={{ width: graph.width * zoom, height: graph.height * zoom }} className={styles.scaledBoard}>
          <div className={styles.board} style={{ width: graph.width, height: graph.height, transform: `scale(${zoom})` }}>
            <svg width={graph.width} height={graph.height} className={styles.connections} aria-hidden="true">
              {graph.edges.map(edge => {
                const from = byId.get(edge.from)!, to = byId.get(edge.to)!;
                const backwards = graph.mirrored && from.side === 'right';
                const x1 = from.x + (backwards ? 0 : BRACKET_CARD.width), x2 = to.x + (backwards ? BRACKET_CARD.width : 0);
                const y1 = from.y + BRACKET_CARD.height / 2, y2 = to.y + (edge.slot === 'HOME' ? 60 : 96);
                const middle = (x1 + x2) / 2;
                return <path key={`${edge.from}-${edge.to}-${edge.slot}`} data-outcome={edge.outcome}
                  data-active={selected ? active.has(edge.from) && active.has(edge.to) : undefined}
                  className={`${styles.connection} ${edge.outcome === 'LOSER' ? styles.loser : ''} ${from.side === 'right' ? styles.rightConnection : ''}`}
                  d={`M ${x1} ${y1} H ${middle} V ${y2} H ${x2}`} />;
              })}
            </svg>
            {graph.nodes.map((node, index) => <button key={node.id} type="button" className={styles.tie}
              data-side={node.side} data-final={node.id === graph.finalId} data-selected={selectedId === node.id} data-dimmed={selected ? !active.has(node.id) : false}
              style={{ left: node.x, top: node.y, width: BRACKET_CARD.width, height: BRACKET_CARD.height, '--tie-delay': `${Math.min(index * 30, 450)}ms` } as CSSProperties}
              aria-pressed={selectedId === node.id} aria-label={`${node.label}: ${bracketEntryName(node.home, node.homeSource)} versus ${bracketEntryName(node.away, node.awaySource)}${node.complete ? ', verified' : ''}`}
              onClick={() => setSelectedId(value => value === node.id ? null : node.id)}>
              <div className={styles.tieHead}><span>{node.id === graph.finalId ? <FcIcon name="trophy" size={12} /> : null}{node.label}</span><small>#{node.position}</small></div>
              {(['home', 'away'] as const).map(side => <div className={styles.team} key={side} data-winner={Boolean(node[side]?.id && node.winnerId === node[side]!.id)}>
                <FcCrest name={bracketEntryName(node[side], node[side === 'home' ? 'homeSource' : 'awaySource'])} imageUrl={node[side]?.entryLogoUrl} size="sm" />
                <span title={bracketEntryName(node[side], node[side === 'home' ? 'homeSource' : 'awaySource'])}>{bracketEntryName(node[side], node[side === 'home' ? 'homeSource' : 'awaySource'])}</span>
                <strong>{node.score?.[side] ?? '–'}</strong>{node[side]?.id && node.winnerId === node[side]!.id ? <FcIcon name="check" size={12} /> : null}
              </div>)}
              <div className={styles.tieFoot}>{node.complete ? <><FcIcon name="check" size={12} />{node.penalties ? `Penalties ${node.penalties.home}–${node.penalties.away}` : node.twoLegged ? 'Verified aggregate' : 'Verified result'}</> : node.twoLegged ? <><FcIcon name={node.locked ? 'lock' : 'fixtures'} size={12} />{node.locked ? 'Leg 2 waits for verified leg 1' : 'Leg 1 verified · leg 2 open'}</> : 'Select to view match'}</div>
            </button>)}
          </div>
        </div>
      </div>
      {selected ? <TieDetails tie={selected} readOnly={readOnly} onClose={() => setSelectedId(null)} /> : null}
    </section>
  );
}

function TieDetails({ tie, readOnly, onClose }: { tie: BracketTie; readOnly: boolean; onClose: () => void }) {
  return <section className={styles.details} aria-label="Selected tie details" aria-live="polite">
    <div className={styles.detailsHead}><div><p className={styles.eyebrow}>{tie.label}</p><h4>{bracketEntryName(tie.home, tie.homeSource)} <span>vs</span> {bracketEntryName(tie.away, tie.awaySource)}</h4></div><button type="button" onClick={onClose} aria-label="Close tie details">×</button></div>
    <div className={styles.legs}>{tie.fixtures.map(fixture => {
      const result = fixture.match?.confirmedResult?.status === 'CONFIRMED' && fixture.match.status === 'COMPLETED' ? fixture.match.confirmedResult : null;
      const locked = tie.twoLegged && fixture.matchday === 2 && tie.locked;
      return <div className={styles.leg} key={fixture.id}><strong>{tie.twoLegged ? `Leg ${fixture.matchday}` : 'Match'} <span>{fixture.fixtureCode}</span></strong>
        <p>{bracketEntryName(fixture.home, fixture.homeSource)} <b>{result ? `${result.homeScore} – ${result.awayScore}` : 'vs'}</b> {bracketEntryName(fixture.away, fixture.awaySource)}</p>
        <small>{result ? `Verified${result.homePenaltyScore != null ? ` · penalties ${result.homePenaltyScore}–${result.awayPenaltyScore}` : ''}` : locked ? 'Locked until first-leg verification' : fixture.match?.status === 'PENDING_VERIFICATION' ? 'Awaiting verification' : 'Awaiting verified result'}</small>
        {!readOnly && fixture.match ? <Link href={`/matches/${fixture.match.id}`}>{locked ? 'View locked match' : 'Open Match Room'} →</Link> : null}
      </div>;
    })}</div>
    {tie.score ? <p className={styles.aggregate}>{tie.twoLegged ? tie.complete ? 'Final aggregate' : 'Aggregate so far' : 'Score'}: {tie.score.home} – {tie.score.away}{tie.penalties ? ` · penalties ${tie.penalties.home}–${tie.penalties.away}` : ''}</p> : null}
  </section>;
}
