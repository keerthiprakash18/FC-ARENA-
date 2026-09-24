export interface CanonicalFixtureLike {
  id: string;
  groupId?: string | null;
  sequence?: number | null;
  homeRegistrationId?: string | null;
  awayRegistrationId?: string | null;
  status?: string | null;

  match?: {
    status?: string | null;
    confirmedResultSubmissionId?: string | null;
  } | null;
}


function fixturePriority(
  fixture: CanonicalFixtureLike,
) {
  if (
    fixture.match
      ?.confirmedResultSubmissionId
  ) {
    return 1000;
  }

  const status =
    fixture.match?.status ||
    fixture.status ||
    'UNSCHEDULED';

  switch (status) {
    case 'COMPLETED':
      return 900;

    case 'LIVE':
    case 'IN_PROGRESS':
      return 800;

    case 'SCHEDULED':
      return 700;

    case 'POSTPONED':
      return 600;

    case 'UNSCHEDULED':
      return 500;

    case 'CANCELLED':
      return 100;

    default:
      return 400;
  }
}


export function fixturePairKey(
  fixture: CanonicalFixtureLike,
  competitionFormat?: string | null,
  legType?: string | null,
) {
  const home =
    fixture.homeRegistrationId;

  const away =
    fixture.awayRegistrationId;

  if (
    !home ||
    !away
  ) {
    return 'fixture:' + fixture.id;
  }

  /*
   * Custom/manual competitions may
   * intentionally schedule the same
   * pairing more than once, so those
   * fixtures must stay independent.
   */
  if (
    competitionFormat ===
    'CUSTOM_MANUAL'
  ) {
    return 'fixture:' + fixture.id;
  }

  const group =
    fixture.groupId ||
    'NO_GROUP';

  /*
   * Double Round Robin legitimately
   * contains two meetings between the
   * same entries. Direction preserves
   * the home/away return leg while still
   * suppressing an accidental duplicate
   * of the exact same leg.
   */
  if (
    competitionFormat ===
      'DOUBLE_ROUND_ROBIN' ||
    legType ===
      'HOME_AWAY'
  ) {
    return [
      group,
      home,
      away,
    ].join(':');
  }

  const pair = [
    home,
    away,
  ].sort();

  return [
    group,
    ...pair,
  ].join(':');
}


export function deduplicateFixtureRecords<
  T extends CanonicalFixtureLike,
>(
  fixtures: T[],
  competitionFormat?: string | null,
  legType?: string | null,
) {
  const canonical =
    new Map<
      string,
      T
    >();

  for (
    const fixture
    of fixtures
  ) {
    const key =
      fixturePairKey(
        fixture,
        competitionFormat,
        legType,
      );

    const current =
      canonical.get(
        key,
      );

    if (!current) {
      canonical.set(
        key,
        fixture,
      );

      continue;
    }

    const fixtureRank =
      fixturePriority(
        fixture,
      );

    const currentRank =
      fixturePriority(
        current,
      );

    if (
      fixtureRank >
      currentRank
    ) {
      canonical.set(
        key,
        fixture,
      );

      continue;
    }

    if (
      fixtureRank ===
      currentRank &&
      (
        fixture.sequence ??
        Number.MAX_SAFE_INTEGER
      ) <
        (
          current.sequence ??
          Number.MAX_SAFE_INTEGER
        )
    ) {
      canonical.set(
        key,
        fixture,
      );
    }
  }

  return Array.from(
    canonical.values(),
  ).sort(
    (
      first,
      second,
    ) =>
      (
        first.sequence ??
        Number.MAX_SAFE_INTEGER
      ) -
      (
        second.sequence ??
        Number.MAX_SAFE_INTEGER
      ),
  );
}
