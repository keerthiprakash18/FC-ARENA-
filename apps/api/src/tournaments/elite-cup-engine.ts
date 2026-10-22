export type EliteCupTeam = string | { id: string } | { teamId: string };

export interface EliteCupFixture {
  key: string;
  roundNumber: number;
  roundName: string;
  matchday: number;
  bracketPosition: number;
  homeTeamId: string;
  awayTeamId: string;
  homeRegistrationId: string;
  awayRegistrationId: string;
}

export interface EliteCupSchedule {
  teamIds: string[];
  requestedMatchesPerTeam: number;
  cappedMatchesPerTeam: number;
  effectiveMatchesPerTeam: number;
  matchdays: number;
  fixtures: EliteCupFixture[];
}

function normalizeTeamIds(teams: readonly EliteCupTeam[]): string[] {
  const teamIds = teams.map((team) => {
    if (typeof team === 'string') {
      return team;
    }

    return 'id' in team ? team.id : team.teamId;
  });

  if (teamIds.some((teamId) => teamId.trim().length === 0)) {
    throw new Error('Elite Cup teams must have non-empty IDs.');
  }

  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error('Elite Cup teams must be unique.');
  }

  if (teamIds.length < 2) {
    throw new Error('Elite Cup requires at least 2 approved teams.');
  }

  return [...teamIds];
}

function validateRequestedMatchesPerTeam(
  requestedMatchesPerTeam: number,
): void {
  if (
    !Number.isInteger(requestedMatchesPerTeam) ||
    requestedMatchesPerTeam < 0
  ) {
    throw new Error(
      'Requested Elite Cup matches per team must be a non-negative integer.',
    );
  }
}

function effectiveDegree(
  teamCount: number,
  requestedMatchesPerTeam: number,
): {
  capped: number;
  effective: number;
} {
  const capped = Math.min(requestedMatchesPerTeam, teamCount - 1);

  // A regular graph on an odd number of vertices can only have an even
  // degree. Rounding up preserves the requested value while remaining within
  // the N - 1 cap, which is even for odd N.
  const effective =
    teamCount % 2 === 1 && capped % 2 === 1 ? capped + 1 : capped;

  return { capped, effective };
}

function orientationCost(homeImbalance: number, awayImbalance: number): number {
  return Math.abs(homeImbalance + 1) + Math.abs(awayImbalance - 1);
}

interface EliteCupPairing {
  leftTeamId: string;
  rightTeamId: string;
  sourceRound: number;
  sourcePosition: number;
}

function canonicalPairKey(leftTeamId: string, rightTeamId: string): string {
  return [leftTeamId, rightTeamId].sort().join(':');
}

function generatePairings(
  teamIds: string[],
  effectiveDegree: number,
): EliteCupPairing[] {
  if (effectiveDegree === 0) {
    return [];
  }

  if (teamIds.length % 2 === 0) {
    const rotating: Array<string | null> = [...teamIds];
    const pairings: EliteCupPairing[] = [];

    for (let roundIndex = 0; roundIndex < effectiveDegree; roundIndex += 1) {
      for (
        let matchIndex = 0;
        matchIndex < rotating.length / 2;
        matchIndex += 1
      ) {
        const leftTeamId = rotating[matchIndex];
        const rightTeamId = rotating[rotating.length - 1 - matchIndex];
        if (leftTeamId === null || rightTeamId === null) {
          continue;
        }

        pairings.push({
          leftTeamId,
          rightTeamId,
          sourceRound: roundIndex + 1,
          sourcePosition: matchIndex + 1,
        });
      }

      const fixed = rotating[0];
      const last = rotating[rotating.length - 1];
      rotating.splice(rotating.length - 1, 1);
      rotating.splice(1, 0, last);
      rotating[0] = fixed!;
    }

    return pairings;
  }

  // Each rotational distance is a 2-factor for an odd number of teams.
  // Selecting effectiveDegree / 2 distances therefore gives every team the
  // requested even degree without relying on uneven bye rounds.
  const pairings: EliteCupPairing[] = [];
  const seen = new Set<string>();
  const factors = effectiveDegree / 2;

  for (let distance = 1; distance <= factors; distance += 1) {
    for (let index = 0; index < teamIds.length; index += 1) {
      const leftTeamId = teamIds[index]!;
      const rightTeamId = teamIds[(index + distance) % teamIds.length]!;
      const key = canonicalPairKey(leftTeamId, rightTeamId);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      pairings.push({
        leftTeamId,
        rightTeamId,
        sourceRound: distance,
        sourcePosition: index + 1,
      });
    }
  }

  return pairings;
}

function addFixture(
  fixtures: EliteCupFixture[],
  roundNumber: number,
  bracketPosition: number,
  homeTeamId: string,
  awayTeamId: string,
): void {
  fixtures.push({
    key: `elite-cup-md-${roundNumber}-f-${bracketPosition}`,
    roundNumber,
    roundName: `MATCHDAY ${roundNumber}`,
    matchday: roundNumber,
    bracketPosition,
    homeTeamId,
    awayTeamId,
    homeRegistrationId: homeTeamId,
    awayRegistrationId: awayTeamId,
  });
}

/**
 * Generate a deterministic partial single round-robin league phase.
 *
 * For an odd number of teams, the requested degree is rounded up to the
 * nearest even degree so every team receives the same number of fixtures.
 */
export function generateEliteCupSchedule(
  teams: readonly EliteCupTeam[],
  requestedMatchesPerTeam = teams.length - 1,
): EliteCupSchedule {
  const teamIds = normalizeTeamIds(teams);
  validateRequestedMatchesPerTeam(requestedMatchesPerTeam);

  const { capped, effective } = effectiveDegree(
    teamIds.length,
    requestedMatchesPerTeam,
  );

  const homeCounts = new Map(teamIds.map((teamId) => [teamId, 0]));
  const awayCounts = new Map(teamIds.map((teamId) => [teamId, 0]));
  const fixtures: EliteCupFixture[] = [];

  const occupiedByMatchday = new Map<number, Set<string>>();
  const pairings = generatePairings(teamIds, effective);

  for (const pairing of pairings) {
    let matchday = pairing.sourceRound;
    while (
      (occupiedByMatchday.get(matchday)?.has(pairing.leftTeamId) ?? false) ||
      (occupiedByMatchday.get(matchday)?.has(pairing.rightTeamId) ?? false)
    ) {
      matchday += 1;
    }

    const left = pairing.leftTeamId;
    const right = pairing.rightTeamId;
    const leftHomeImbalance =
      (homeCounts.get(left) ?? 0) - (awayCounts.get(left) ?? 0);
    const rightHomeImbalance =
      (homeCounts.get(right) ?? 0) - (awayCounts.get(right) ?? 0);
    const leftHomeCost = orientationCost(leftHomeImbalance, rightHomeImbalance);
    const rightHomeCost = orientationCost(
      rightHomeImbalance,
      leftHomeImbalance,
    );

    // For odd team counts, each selected rotational factor is a directed
    // cycle. Its natural direction gives every team one home and one away
    // fixture per factor, keeping the complete schedule exactly balanced.
    const leftIsHome =
      teamIds.length % 2 === 1
        ? true
        : leftHomeCost < rightHomeCost ||
          (leftHomeCost === rightHomeCost &&
            (pairing.sourceRound + pairing.sourcePosition) % 2 === 0);
    const homeTeamId = leftIsHome ? left : right;
    const awayTeamId = leftIsHome ? right : left;

    const matchdayTeams = occupiedByMatchday.get(matchday) ?? new Set<string>();
    addFixture(
      fixtures,
      matchday,
      matchdayTeams.size / 2 + 1,
      homeTeamId,
      awayTeamId,
    );
    matchdayTeams.add(homeTeamId);
    matchdayTeams.add(awayTeamId);
    occupiedByMatchday.set(matchday, matchdayTeams);
    homeCounts.set(homeTeamId, (homeCounts.get(homeTeamId) ?? 0) + 1);
    awayCounts.set(awayTeamId, (awayCounts.get(awayTeamId) ?? 0) + 1);
  }

  const matchdays = Math.max(0, ...fixtures.map((fixture) => fixture.matchday));

  return {
    teamIds,
    requestedMatchesPerTeam,
    cappedMatchesPerTeam: capped,
    effectiveMatchesPerTeam: effective,
    matchdays,
    fixtures,
  };
}

export const generateEliteCupLeaguePhase = generateEliteCupSchedule;
export const generateEliteCupLeaguePhaseSchedule = generateEliteCupSchedule;
export const generateEliteCupFixtures = generateEliteCupSchedule;
export const buildEliteCupSchedule = generateEliteCupSchedule;

function validateTeamCount(teamCount: number): void {
  if (!Number.isInteger(teamCount) || teamCount < 2) {
    throw new Error('Elite Cup requires a team count of at least 2.');
  }
}

function highestPowerOfTwoAtMost(value: number): number {
  let result = 1;
  while (result * 2 <= value) {
    result *= 2;
  }
  return result;
}

/** Resolve the automatic playoff field size, or validate an explicit override. */
export function resolveEliteCupPlayoffQualifierCount(
  teamCount: number,
  override?: number,
): number {
  validateTeamCount(teamCount);

  if (override !== undefined) {
    if (!Number.isInteger(override) || override < 2 || override > teamCount) {
      throw new Error(
        `Elite Cup playoff qualifier override must be an integer between 2 and ${teamCount}.`,
      );
    }

    return override;
  }

  if (teamCount <= 3) {
    return teamCount;
  }

  return Math.min(16, highestPowerOfTwoAtMost(teamCount));
}

export const resolveEliteCupPlayoffQualifiers =
  resolveEliteCupPlayoffQualifierCount;
export const resolveEliteCupQualifiers = resolveEliteCupPlayoffQualifierCount;
