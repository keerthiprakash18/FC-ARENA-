interface QualifyingGroup {
  id: string;
  name?: string;
  position?: number;
  registrations: Array<{
    id: string;
    entryName: string | null;
    standing: { points: number; goalDifference: number; goalsFor: number; wins: number } | null;
  }>;
}

// Include all eligible entries, not just the selected seeds: a correction to a
// previously non-qualifying entry may change qualification. Used to verify the
// preflight ranking snapshot again within the bracket creation transaction.
export function qualificationSnapshot(groups: QualifyingGroup[]): string {
  return JSON.stringify(groups.map((group) => ({
    id: group.id,
    name: group.name,
    position: group.position,
    entries: group.registrations.map((entry) => ({
      id: entry.id, name: entry.entryName,
      points: entry.standing?.points ?? 0,
      goalDifference: entry.standing?.goalDifference ?? 0,
      goalsFor: entry.standing?.goalsFor ?? 0,
      wins: entry.standing?.wins ?? 0,
    })).sort((left, right) => left.id.localeCompare(right.id)),
  })).sort((left, right) => left.id.localeCompare(right.id)));
}
