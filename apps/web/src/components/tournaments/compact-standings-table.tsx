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
          <caption className="sr-only">{label} — rank, team, played, goals for, goals against, goal difference and points. Tap a team for wins, draws, losses and recent form.</caption>
          <colgroup>
            <col className="fc-compact-rank-column" />
            <col />
            <col className="fc-compact-played-column" />
            <col className="fc-compact-goals-column" />
            <col className="fc-compact-goals-column" />
            <col className="fc-compact-difference-column" />
            <col className="fc-compact-points-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" aria-label="Rank">#</th>
              <th scope="col" className="fc-compact-team-heading">Team / Duo</th>
              <th scope="col" aria-label="Played">P</th>
              <th scope="col" aria-label="Goals for">GF</th>
              <th scope="col" aria-label="Goals against">GA</th>
              <th scope="col" aria-label="Goal difference">GD</th>
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
                    <td>{row.goalsFor}</td>
                    <td>{row.goalsAgainst}</td>
                    <td className="fc-compact-difference">{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</td>
                    <td className="fc-compact-points">{row.points}</td>
                  </tr>
                  <tr id={detailId} className="fc-compact-detail-row" hidden={!expanded}>
                    <td colSpan={7}>
                      <strong>{row.entryName}</strong>
                      <dl>
                        <div><dt>Won</dt><dd>{row.wins}</dd></div>
                        <div><dt>Drawn</dt><dd>{row.draws}</dd></div>
                        <div><dt>Lost</dt><dd>{row.losses}</dd></div>
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
      <p className="fc-compact-standings-hint">Tap a team for W / D / L &amp; form</p>
    </div>
  );
}
