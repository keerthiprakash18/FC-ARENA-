/**
 * Competition team honours are derived from canonical confirmed fixture scores.
 * They are persisted in the immutable tournament summary snapshot, separate
 * from individual player Achievement records. No fabricated individual goals.
 */
export interface TeamHonourFixture {
  id: string;
  status: string;
  fixture: {
    id: string;
    status?: string;
    homeRegistrationId: string | null;
    awayRegistrationId: string | null;
  } | null;
  confirmedResult: {
    status: string;
    homeScore: number;
    awayScore: number;
  } | null;
}

export interface TeamHonourRow {
  registrationId: string;
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
}
export interface TeamHonourWinner {
  registrationId: string;
  value: number;
  matches: number;
}
export interface TeamHonours {
  scope: 'TEAM';
  source: 'CONFIRMED_FIXTURE_RESULTS';
  entries: TeamHonourRow[];
  goldenBoot: TeamHonourWinner[];
  defensiveRecord: TeamHonourWinner[];
}

export function calculateTeamHonours(
  fixtures: readonly TeamHonourFixture[],
  approvedRegistrationIds: ReadonlySet<string>,
): TeamHonours {
  const scores = new Map<string, TeamHonourRow>();
  const seen = new Set<string>();
  const record = (registrationId: string, goalsFor: number, goalsAgainst: number) => {
    const row = scores.get(registrationId) ?? { registrationId, matches: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 };
    row.matches += 1;
    row.goalsFor += goalsFor;
    row.goalsAgainst += goalsAgainst;
    row.cleanSheets += goalsAgainst === 0 ? 1 : 0;
    scores.set(registrationId, row);
  };
  for (const match of fixtures) {
    const fixture = match.fixture;
    const result = match.confirmedResult;
    if (!fixture || !result || match.status !== 'COMPLETED' ||
      fixture.status === 'CANCELLED' || (fixture.status && fixture.status !== 'COMPLETED') ||
      result.status !== 'CONFIRMED' || seen.has(fixture.id)) continue;
    const home = fixture.homeRegistrationId;
    const away = fixture.awayRegistrationId;
    if (!home || !away || home === away ||
      !approvedRegistrationIds.has(home) || !approvedRegistrationIds.has(away) ||
      ![result.homeScore, result.awayScore].every(value => Number.isSafeInteger(value) && value >= 0)) continue;
    seen.add(fixture.id);
    record(home, result.homeScore, result.awayScore);
    record(away, result.awayScore, result.homeScore);
  }
  const entries = [...scores.values()].sort((a, b) => a.registrationId.localeCompare(b.registrationId));
  const maxGoals = Math.max(0, ...entries.map(row => row.goalsFor));
  const goldenBoot = maxGoals > 0 ? entries.filter(row => row.goalsFor === maxGoals).map(row => ({
    registrationId: row.registrationId, value: row.goalsFor, matches: row.matches,
  })) : [];
  // When no team has a clean sheet, there is no defensive winner.
  const bestCleanSheets = Math.max(0, ...entries.map(row => row.cleanSheets));
  const cleanSheetLeaders = entries.filter(row => row.cleanSheets === bestCleanSheets && row.matches > 0);
  const leastConcededRate = Math.min(...cleanSheetLeaders.map(row => row.goalsAgainst / row.matches));
  const defensiveRecord = bestCleanSheets > 0
    ? cleanSheetLeaders.filter(row => row.goalsAgainst / row.matches === leastConcededRate)
      .map(row => ({ registrationId: row.registrationId, value: row.cleanSheets, matches: row.matches }))
    : [];
  return { scope: 'TEAM', source: 'CONFIRMED_FIXTURE_RESULTS', entries, goldenBoot, defensiveRecord };
}
