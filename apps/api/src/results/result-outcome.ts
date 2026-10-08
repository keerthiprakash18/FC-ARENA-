export type Outcome = 'W' | 'D' | 'L';

export interface SideDelta extends Record<string, string | number> {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  outcome: Outcome;
}

// Established tournament scoring: W=3, D=1, L=0. Confirmation, correction
// and canonical standings rebuilding must use exactly the same calculation.
export function calculateResultDelta(goalsFor: number, goalsAgainst: number): SideDelta {
  const outcome: Outcome = goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L';
  return {
    wins: outcome === 'W' ? 1 : 0,
    draws: outcome === 'D' ? 1 : 0,
    losses: outcome === 'L' ? 1 : 0,
    goalsFor, goalsAgainst, goalDifference: goalsFor - goalsAgainst,
    points: outcome === 'W' ? 3 : outcome === 'D' ? 1 : 0,
    outcome,
  };
}
