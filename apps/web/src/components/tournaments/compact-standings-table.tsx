'use client';

import { Fragment, useId, useState } from 'react';
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
}: {
  label: string;
  rows: CompactStanding[];
  highlightedPositions?: number;
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
              const expanded = expandedId === row.registrationId;
              const detailId = `${id}-detail-${index}`;
              return (
                <Fragment key={row.registrationId}>
                  <tr className="fc-compact-team-row" data-highlighted={row.position <= highlightedPositions}>
                    <td className="fc-compact-rank">{row.position}</td>
                    <th scope="row" className="fc-compact-team-cell">
                      <button type="button" className="fc-compact-team-button" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedId(expanded ? null : row.registrationId)}>
                        <span aria-hidden="true"><FcCrest name={row.entryName} imageUrl={row.logoUrl} size="sm" /></span>
                        <span className="fc-compact-team-name" title={row.entryName}>{row.entryName}</span>
                      </button>
                    </th>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.draws}</td>
                    <td className="fc-compact-last-stat">{row.losses}</td>
                    <td className="fc-compact-points">{row.points}</td>
                  </tr>
                  <tr id={detailId} className="fc-compact-detail-row" hidden={!expanded}>
                    <td colSpan={7}>
                      <strong>{row.entryName}</strong>
                      <dl>
                        <div><dt>GF</dt><dd>{row.goalsFor}</dd></div>
                        <div><dt>GA</dt><dd>{row.goalsAgainst}</dd></div>
                        <div><dt>GD</dt><dd>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</dd></div>
                        <div><dt>Form</dt><dd>{row.form || '—'}</dd></div>
                      </dl>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fc-compact-standings-hint">Tap a team for GF / GA / GD &amp; form</p>
    </div>
  );
}
