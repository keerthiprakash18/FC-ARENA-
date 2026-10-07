export interface CompletionMatchLike {
  status: string;
  confirmedResultSubmissionId?: string | null;
}

export function requiresConfirmedResultForEveryFixture(
  competitionFormat?: string | null,
  legType?: string | null,
) {
  return (
    competitionFormat === 'DOUBLE_ROUND_ROBIN' ||
    legType === 'HOME_AWAY'
  );
}

export function countMissingRequiredFixtureResults(
  matches: CompletionMatchLike[],
  competitionFormat?: string | null,
  legType?: string | null,
) {
  if (
    !requiresConfirmedResultForEveryFixture(
      competitionFormat,
      legType,
    )
  ) {
    return 0;
  }

  return matches.filter(
    (match) =>
      match.status !== 'COMPLETED' ||
      !match.confirmedResultSubmissionId,
  ).length;
}
