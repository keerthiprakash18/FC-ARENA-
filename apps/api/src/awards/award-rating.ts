export interface AwardCandidateInput {
  userId: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  maxWinningStreak: number;
  bigMatchRaw: number;
}

export interface AwardRatingBreakdown {
  matchPerformance: number;
  attack: number;
  defence: number;
  goalDifference: number;
  bigMatches: number;
  consistency: number;
  total: number;
}

function round1(value: number) {
  return Number(value.toFixed(1));
}

function safeRate(
  numerator: number,
  denominator: number,
) {
  return denominator > 0
    ? numerator / denominator
    : 0;
}

export function scoreAwardCandidates<
  T extends AwardCandidateInput,
>(
  candidates: T[],
): Array<T & {
  rating: number;
  ratingBreakdown: AwardRatingBreakdown;
  pointsPerMatch: number;
  winRate: number;
  goalsPerMatch: number;
  goalsAgainstPerMatch: number;
  cleanSheetRate: number;
  goalDifferencePerMatch: number;
}> {
  const metrics = candidates.map(
    (candidate) => {
      const points =
        candidate.wins * 3 +
        candidate.draws;

      return {
        ...candidate,
        pointsPerMatch:
          safeRate(
            points,
            candidate.matches,
          ),
        winRate:
          safeRate(
            candidate.wins,
            candidate.matches,
          ),
        goalsPerMatch:
          safeRate(
            candidate.goalsFor,
            candidate.matches,
          ),
        goalsAgainstPerMatch:
          safeRate(
            candidate.goalsAgainst,
            candidate.matches,
          ),
        cleanSheetRate:
          safeRate(
            candidate.cleanSheets,
            candidate.matches,
          ),
        goalDifferencePerMatch:
          safeRate(
            candidate.goalsFor -
              candidate.goalsAgainst,
            candidate.matches,
          ),
      };
    },
  );

  const maxGoalsPerMatch =
    Math.max(
      0,
      ...metrics.map(
        (candidate) =>
          candidate.goalsPerMatch,
      ),
    );

  const maxGoalsAgainstPerMatch =
    Math.max(
      0,
      ...metrics.map(
        (candidate) =>
          candidate.goalsAgainstPerMatch,
      ),
    );

  const maxPositiveGoalDifferencePerMatch =
    Math.max(
      0,
      ...metrics.map(
        (candidate) =>
          Math.max(
            0,
            candidate.goalDifferencePerMatch,
          ),
      ),
    );

  return metrics.map(
    (candidate) => {
      const matchPerformance =
        Math.min(
          30,
          safeRate(
            candidate.pointsPerMatch,
            3,
          ) * 30,
        );

      const attack =
        maxGoalsPerMatch > 0
          ? Math.min(
              20,
              safeRate(
                candidate.goalsPerMatch,
                maxGoalsPerMatch,
              ) * 20,
            )
          : 0;

      const cleanSheetComponent =
        Math.min(
          9,
          candidate.cleanSheetRate *
            9,
        );

      const goalsAgainstComponent =
        maxGoalsAgainstPerMatch >
        0
          ? Math.max(
              0,
              (
                1 -
                safeRate(
                  candidate.goalsAgainstPerMatch,
                  maxGoalsAgainstPerMatch,
                )
              ) * 6,
            )
          : 6;

      const defence =
        Math.min(
          15,
          cleanSheetComponent +
            goalsAgainstComponent,
        );

      const goalDifference =
        maxPositiveGoalDifferencePerMatch >
        0
          ? Math.min(
              15,
              safeRate(
                Math.max(
                  0,
                  candidate.goalDifferencePerMatch,
                ),
                maxPositiveGoalDifferencePerMatch,
              ) * 15,
            )
          : 0;

      const bigMatches =
        Math.min(
          15,
          safeRate(
            Math.max(
              0,
              candidate.bigMatchRaw,
            ),
            10,
          ) * 15,
        );

      const consistency =
        Math.min(
          5,
          candidate.winRate * 3 +
            Math.min(
              1,
              safeRate(
                candidate.maxWinningStreak,
                5,
              ),
            ) *
              2,
        );

      const breakdown = {
        matchPerformance:
          round1(
            matchPerformance,
          ),
        attack:
          round1(attack),
        defence:
          round1(defence),
        goalDifference:
          round1(
            goalDifference,
          ),
        bigMatches:
          round1(bigMatches),
        consistency:
          round1(
            consistency,
          ),
        total:
          round1(
            matchPerformance +
              attack +
              defence +
              goalDifference +
              bigMatches +
              consistency,
          ),
      };

      return {
        ...candidate,
        pointsPerMatch:
          round1(
            candidate.pointsPerMatch,
          ),
        winRate:
          round1(
            candidate.winRate *
              100,
          ),
        goalsPerMatch:
          round1(
            candidate.goalsPerMatch,
          ),
        goalsAgainstPerMatch:
          round1(
            candidate.goalsAgainstPerMatch,
          ),
        cleanSheetRate:
          round1(
            candidate.cleanSheetRate *
              100,
          ),
        goalDifferencePerMatch:
          round1(
            candidate.goalDifferencePerMatch,
          ),
        rating:
          breakdown.total,
        ratingBreakdown:
          breakdown,
      };
    },
  );
}

export function sortGoldenBoot<
  T extends {
    goalsFor: number;
    goalsPerMatch: number;
    goalDifference: number;
    wins: number;
    displayName: string;
  },
>(candidates: T[]) {
  return [...candidates].sort(
    (a, b) =>
      b.goalsFor -
        a.goalsFor ||
      b.goalsPerMatch -
        a.goalsPerMatch ||
      b.goalDifference -
        a.goalDifference ||
      b.wins -
        a.wins ||
      a.displayName.localeCompare(
        b.displayName,
      ),
  );
}

export function sortGoldenGlove<
  T extends {
    cleanSheets: number;
    cleanSheetRate: number;
    goalsAgainstPerMatch: number;
    matches: number;
    goalsAgainst: number;
    displayName: string;
  },
>(candidates: T[]) {
  return [...candidates].sort(
    (a, b) =>
      b.cleanSheets -
        a.cleanSheets ||
      b.cleanSheetRate -
        a.cleanSheetRate ||
      a.goalsAgainstPerMatch -
        b.goalsAgainstPerMatch ||
      b.matches -
        a.matches ||
      a.goalsAgainst -
        b.goalsAgainst ||
      a.displayName.localeCompare(
        b.displayName,
      ),
  );
}

export function sortPlayerOfTournament<
  T extends {
    rating: number;
    wins: number;
    goalDifference: number;
    goalsFor: number;
    displayName: string;
  },
>(candidates: T[]) {
  return [...candidates].sort(
    (a, b) =>
      b.rating -
        a.rating ||
      b.wins -
        a.wins ||
      b.goalDifference -
        a.goalDifference ||
      b.goalsFor -
        a.goalsFor ||
      a.displayName.localeCompare(
        b.displayName,
      ),
  );
}
