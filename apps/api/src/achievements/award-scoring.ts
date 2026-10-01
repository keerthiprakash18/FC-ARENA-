export interface AwardMetricRow {
  userId: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
  bigMatchPoints: number;
  longestWinStreak: number;
}

export interface RatingWeights {
  matchPerformance: number;
  attack: number;
  defence: number;
  goalDifference: number;
  bigMatches: number;
  consistency: number;
}

export interface RatingBreakdown {
  matchPerformance: number;
  attack: number;
  defence: number;
  goalDifference: number;
  bigMatches: number;
  consistency: number;
}

export interface RatedAwardRow extends AwardMetricRow {
  rating: number;
  ratingBreakdown: RatingBreakdown;
  pointsPerMatch: number;
  winRate: number;
  goalsPerMatch: number;
  cleanSheetRate: number;
  goalsAgainstPerMatch: number;
  goalDifferencePerMatch: number;
}

export const DEFAULT_RATING_WEIGHTS: RatingWeights = {
  matchPerformance: 30,
  attack: 20,
  defence: 15,
  goalDifference: 15,
  bigMatches: 15,
  consistency: 5,
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function rounded(value: number) {
  return Number(value.toFixed(1));
}

function ratio(value: number, maximum: number) {
  return maximum > 0
    ? clamp(value / maximum)
    : 0;
}

function metrics(row: AwardMetricRow) {
  const matches = Math.max(0, row.matches);

  return {
    pointsPerMatch:
      matches > 0
        ? (row.wins * 3 + row.draws) / matches
        : 0,

    winRate:
      matches > 0
        ? row.wins / matches
        : 0,

    goalsPerMatch:
      matches > 0
        ? row.goalsFor / matches
        : 0,

    cleanSheetRate:
      matches > 0
        ? row.cleanSheets / matches
        : 0,

    goalsAgainstPerMatch:
      matches > 0
        ? row.goalsAgainst / matches
        : 0,

    goalDifferencePerMatch:
      matches > 0
        ? row.goalDifference / matches
        : 0,
  };
}

export function calculatePerformanceRatings(
  rows: AwardMetricRow[],
  weights: RatingWeights = DEFAULT_RATING_WEIGHTS,
): RatedAwardRow[] {
  const enriched = rows.map((row) => ({
    ...row,
    ...metrics(row),
  }));

  const maxGoals =
    Math.max(0, ...enriched.map((row) => row.goalsFor));
  const maxGoalsPerMatch =
    Math.max(0, ...enriched.map((row) => row.goalsPerMatch));
  const maxCleanSheetRate =
    Math.max(0, ...enriched.map((row) => row.cleanSheetRate));
  const maxPositiveGoalDifferencePerMatch =
    Math.max(
      0,
      ...enriched.map((row) =>
        Math.max(0, row.goalDifferencePerMatch),
      ),
    );

  const concededRates =
    enriched
      .filter((row) => row.matches > 0)
      .map((row) => row.goalsAgainstPerMatch);

  const bestConcededRate =
    concededRates.length > 0
      ? Math.min(...concededRates)
      : 0;

  const worstConcededRate =
    concededRates.length > 0
      ? Math.max(...concededRates)
      : 0;

  return enriched
    .map((row) => {
      const matchPerformance =
        weights.matchPerformance *
        (
          0.55 * clamp(row.pointsPerMatch / 3) +
          0.45 * clamp(row.winRate)
        );

      const attack =
        weights.attack *
        (
          0.7 * ratio(row.goalsPerMatch, maxGoalsPerMatch) +
          0.3 * ratio(row.goalsFor, maxGoals)
        );

      const concededSpan =
        worstConcededRate - bestConcededRate;

      const concededEfficiency =
        row.matches === 0
          ? 0
          : concededSpan > 0
            ? clamp(
                (worstConcededRate - row.goalsAgainstPerMatch) /
                  concededSpan,
              )
            : 1;

      const defence =
        weights.defence *
        (
          0.6 *
            ratio(row.cleanSheetRate, maxCleanSheetRate) +
          0.4 * concededEfficiency
        );

      const goalDifference =
        weights.goalDifference *
        ratio(
          Math.max(0, row.goalDifferencePerMatch),
          maxPositiveGoalDifferencePerMatch,
        );

      const bigMatches =
        Math.min(
          weights.bigMatches,
          Math.max(0, row.bigMatchPoints),
        );

      const lossRate =
        row.matches > 0
          ? row.losses / row.matches
          : 1;

      const consistency =
        weights.consistency *
        (
          0.6 * clamp(row.longestWinStreak / 5) +
          0.4 * clamp(1 - lossRate)
        );

      const ratingBreakdown = {
        matchPerformance: rounded(matchPerformance),
        attack: rounded(attack),
        defence: rounded(defence),
        goalDifference: rounded(goalDifference),
        bigMatches: rounded(bigMatches),
        consistency: rounded(consistency),
      };

      const rating = rounded(
        Object.values(ratingBreakdown)
          .reduce((sum, value) => sum + value, 0),
      );

      return {
        ...row,
        rating,
        ratingBreakdown,
      };
    })
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.pointsPerMatch - a.pointsPerMatch ||
        b.winRate - a.winRate ||
        b.goalDifferencePerMatch - a.goalDifferencePerMatch ||
        b.goalsPerMatch - a.goalsPerMatch ||
        a.userId.localeCompare(b.userId),
    );
}

export function goldenBootOrder(
  first: AwardMetricRow,
  second: AwardMetricRow,
) {
  const a = metrics(first);
  const b = metrics(second);

  return (
    second.goalsFor - first.goalsFor ||
    b.goalsPerMatch - a.goalsPerMatch ||
    second.goalDifference - first.goalDifference ||
    second.wins - first.wins ||
    first.userId.localeCompare(second.userId)
  );
}

export function goldenGloveOrder(
  first: AwardMetricRow,
  second: AwardMetricRow,
) {
  const a = metrics(first);
  const b = metrics(second);

  return (
    second.cleanSheets - first.cleanSheets ||
    b.cleanSheetRate - a.cleanSheetRate ||
    a.goalsAgainstPerMatch - b.goalsAgainstPerMatch ||
    second.matches - first.matches ||
    first.goalsAgainst - second.goalsAgainst ||
    first.userId.localeCompare(second.userId)
  );
}

export function tiedGoldenBootWinners(
  rows: AwardMetricRow[],
) {
  const ranked = [...rows].sort(goldenBootOrder);

  if (ranked.length === 0 || ranked[0].goalsFor <= 0) {
    return [];
  }

  const winner = ranked[0];
  const winnerMetrics = metrics(winner);

  return ranked.filter((row) => {
    const rowMetrics = metrics(row);

    return (
      row.goalsFor === winner.goalsFor &&
      rowMetrics.goalsPerMatch === winnerMetrics.goalsPerMatch &&
      row.goalDifference === winner.goalDifference &&
      row.wins === winner.wins
    );
  });
}

export function tiedGoldenGloveWinners(
  rows: AwardMetricRow[],
) {
  const eligible = rows.filter((row) => row.matches > 0);
  const ranked = [...eligible].sort(goldenGloveOrder);

  if (ranked.length === 0) {
    return [];
  }

  const winner = ranked[0];
  const winnerMetrics = metrics(winner);

  return ranked.filter((row) => {
    const rowMetrics = metrics(row);

    return (
      row.cleanSheets === winner.cleanSheets &&
      rowMetrics.cleanSheetRate === winnerMetrics.cleanSheetRate &&
      rowMetrics.goalsAgainstPerMatch ===
        winnerMetrics.goalsAgainstPerMatch &&
      row.matches === winner.matches &&
      row.goalsAgainst === winner.goalsAgainst
    );
  });
}
