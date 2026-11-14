'use client';

import { Fragment, useId, useState } from 'react';
import type { QualificationBand } from '@/lib/tournament-format-guide';
import { FcCrest } from '@/components/fc/fc-ui';

interface CompactStanding {
  registrationId: string;
  position: number;
  entryName: string;
  logoUrl?: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
}

// Presentation only: row order, positions and statistics come from the caller.
export function CompactStandingsTable({
  label,
  rows,
  highlightedPositions = 1,
  qualificationBands,
}: {
  label: string;
  rows: CompactStanding[];
  highlightedPositions?: number;
  qualificationBands?: QualificationBand[];
}) {
  const id = useId();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="fc-compact-standings sm:hidden">
      <div className="fc-compact-standings-scroll" role="region" aria-label={label} tabIndex={0}>
        <table className="fc-compact-standings-table">
          <caption className="sr-only">{label} — rank, team, played, wins, draws, losses and points. Tap a team for goals for, goals against, goal difference and recent form.</caption>
          <colgroup>
            <col className="fc-compact-rank-column" />
            <col />
            <col className="fc-compact-played-column" />
            <col className="fc-compact-stat-column" />
            <col className="fc-compact-stat-column" />
            <col className="fc-compact-last-stat-column" />
            <col className="fc-compact-points-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" aria-label="Rank">#</th>
              <th scope="col" className="fc-compact-team-heading">Team / Duo</th>
              <th scope="col" aria-label="Played">P</th>
              <th scope="col" aria-label="Won">W</th>
              <th scope="col" aria-label="Drawn">D</th>
              <th scope="col" aria-label="Lost">L</th>
              <th scope="col" className="fc-compact-points" aria-label="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const band = qualificationBands?.find(band => row.position >= band.from && row.position <= band.to);
              const expanded = expandedId === row.registrationId;
              const detailId = `${id}-detail-${index}`;
              return (
                <Fragment key={row.registrationId}>
                  <tr className="fc-compact-team-row" data-highlighted={qualificationBands ? !!band : row.position <= highlightedPositions} data-qualification={band?.tone}>
                    <td className="fc-compact-rank" title={band?.label}>{row.position}{band ? <span className="sr-only"> · {band.label}</span> : null}</td>
                    <th scope="row" className="fc-compact-team-cell">
                      <button type="button" className="fc-compact-team-button" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedId(expanded ? null : row.registrationId)}>
                        <span aria-hidden="true"><FcCrest name={row.entryName} imageUrl={row.logoUrl} size="sm" /></span>
                        <span className="fc-compact-team-name" title={row.entryName}>{row.entryName}</span>
                        <span className="sr-only">, {expanded ? "hide" : "show"} statistics</span>
                      </button>
                    </th>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.draws}</td>
                    <td className="fc-compact-last-stat">{row.losses}</td>
                    <td className="fc-compact-points"><span className="fc-compact-points-value">{row.points}</span></td>
                  </tr>
                  <tr id={detailId} className="fc-compact-detail-row" hidden={!expanded}>
                    <td colSpan={7}>
                      <strong>{row.entryName}</strong>
                      <dl>
                        <div><dt>Goals for</dt><dd>{row.goalsFor}</dd></div>
                        <div><dt>Goals against</dt><dd>{row.goalsAgainst}</dd></div>
                        <div><dt>Goal difference</dt><dd>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</dd></div>
                        <div><dt>Recent form</dt><dd className="fc-compact-form">{row.form ? [...row.form.replace(/[^WDL]/g, '').slice(0, 5)].map((result, index) => <span key={index} data-result={result} title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}>{result}</span>) : '—'}</dd></div>
                      </dl>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fc-compact-standings-hint">Win 3 pts · Draw 1 pt · Loss 0 pts<br />Tap a team for goals &amp; recent form</p>
    </div>
  );
}
