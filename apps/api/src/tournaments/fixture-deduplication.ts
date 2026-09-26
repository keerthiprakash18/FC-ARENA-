export interface CanonicalFixtureLike {
  id: string;
  groupId?: string | null;
  sequence?: number | null;
  matchday?: number | null;
  roundNumber?: number | null;
  homeRegistrationId?: string | null;
  awayRegistrationId?: string | null;
  status?: string | null;

  match?: {
    status?: string | null;
    confirmedResultSubmissionId?: string | null;

    confirmedResult?: {
      id?: string | null;
      status?: string | null;
    } | null;
  } | null;
}


export function isCanonicalCompletedFixture(
  fixture: CanonicalFixtureLike,
) {
  const match =
    fixture.match;

  const confirmedResult =
    match?.confirmedResult;

  const confirmedResultSubmissionId =
    match?.confirmedResultSubmissionId;

  const isShownAsCompleted =
    match?.status ===
      'COMPLETED' &&
    fixture.status ===
      'COMPLETED';

  return Boolean(
    isShownAsCompleted &&
    confirmedResultSubmissionId &&
    confirmedResult &&
    confirmedResult.status ===
      'CONFIRMED' &&
    confirmedResult.id ===
      confirmedResultSubmissionId,
  );
}


function fixturePriority(
  fixture: CanonicalFixtureLike,
) {
  const status =
    fixture.match?.status ||
    fixture.status ||
    'UNSCHEDULED';

  /*
   * A legacy/stale result pointer must
   * never make an UNSCHEDULED fixture
   * outrank the real completed fixture.
   * Result links receive top priority
   * only when the fixture is also shown
   * as completed by the fixtures API.
   */
  if (
    fixture.match
      ?.confirmedResultSubmissionId &&
    (
      fixture.match?.status ===
        'COMPLETED' ||
      fixture.status ===
        'COMPLETED'
    )
  ) {
    return 1000;
  }

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


function fixtureMatchday(
  fixture: CanonicalFixtureLike,
) {
  if (
    typeof fixture.matchday ===
      'number' &&
    Number.isInteger(
      fixture.matchday,
    )
  ) {
    return fixture.matchday;
  }

  if (
    typeof fixture.roundNumber ===
      'number' &&
    Number.isInteger(
      fixture.roundNumber,
    )
  ) {
    return fixture.roundNumber;
  }

  return null;
}


function selectPreferredFixture<
  T extends CanonicalFixtureLike,
>(
  current: T | undefined,
  candidate: T,
) {
  if (!current) {
    return candidate;
  }

  const candidateRank =
    fixturePriority(
      candidate,
    );

  const currentRank =
    fixturePriority(
      current,
    );

  if (
    candidateRank >
    currentRank
  ) {
    return candidate;
  }

  if (
    candidateRank <
    currentRank
  ) {
    return current;
  }

  return (
    (
      candidate.sequence ??
      Number.MAX_SAFE_INTEGER
    ) <
    (
      current.sequence ??
      Number.MAX_SAFE_INTEGER
    )
  )
    ? candidate
    : current;
}


/*
 * Fixture-list canonicalization is
 * intentionally stricter than the
 * low-level pair deduper above.
 *
 * In Home & Away competitions, an old
 * or accidental reversed copy inside
 * the SAME leg must not appear as a
 * second logical match in the UI.
 * The real return fixture in the second
 * leg must remain independent.
 *
 * This helper is safe for a complete
 * generated fixture list because it
 * infers each scope's leg boundary only
 * when Matchdays are contiguous from
 * 1..N and N is even. If that condition
 * is not met, it falls back to the
 * existing direction-aware behavior.
 */
export function deduplicateVisibleFixtureRecords<
  T extends CanonicalFixtureLike,
>(
  fixtures: T[],
  competitionFormat?: string | null,
  legType?: string | null,
) {
  const homeAway =
    competitionFormat ===
      'DOUBLE_ROUND_ROBIN' ||
    legType ===
      'HOME_AWAY';

  if (!homeAway) {
    return deduplicateFixtureRecords(
      fixtures,
      competitionFormat,
      legType,
    );
  }

  const matchdaysByScope =
    new Map<
      string,
      Set<number>
    >();

  for (
    const fixture
    of fixtures
  ) {
    const matchday =
      fixtureMatchday(
        fixture,
      );

    if (
      matchday === null
    ) {
      continue;
    }

    const scope =
      fixture.groupId ||
      'NO_GROUP';

    const values =
      matchdaysByScope.get(
        scope,
      ) ??
      new Set<number>();

    values.add(
      matchday,
    );

    matchdaysByScope.set(
      scope,
      values,
    );
  }

  const roundsPerLegByScope =
    new Map<
      string,
      number
    >();

  for (
    const [
      scope,
      matchdays,
    ]
    of matchdaysByScope
  ) {
    const ordered =
      [...matchdays].sort(
        (
          first,
          second,
        ) =>
          first -
          second,
      );

    const maxMatchday =
      ordered[
        ordered.length - 1
      ];

    if (
      !maxMatchday ||
      maxMatchday %
        2 !==
        0 ||
      ordered.length !==
        maxMatchday
    ) {
      continue;
    }

    let contiguous =
      true;

    for (
      let index = 0;
      index <
      ordered.length;
      index++
    ) {
      if (
        ordered[index] !==
        index + 1
      ) {
        contiguous =
          false;

        break;
      }
    }

    if (
      contiguous
    ) {
      roundsPerLegByScope.set(
        scope,
        maxMatchday / 2,
      );
    }
  }

  const canonical =
    new Map<
      string,
      T
    >();

  for (
    const fixture
    of fixtures
  ) {
    const home =
      fixture.homeRegistrationId;

    const away =
      fixture.awayRegistrationId;

    const matchday =
      fixtureMatchday(
        fixture,
      );

    const scope =
      fixture.groupId ||
      'NO_GROUP';

    const roundsPerLeg =
      roundsPerLegByScope.get(
        scope,
      );

    let key: string;

    if (
      home &&
      away &&
      matchday !==
        null &&
      roundsPerLeg
    ) {
      const pair =
        [
          home,
          away,
        ].sort();

      const leg =
        matchday <=
        roundsPerLeg
          ? 1
          : 2;

      key = [
        scope,
        ...pair,
        'LEG',
        leg,
      ].join(
        ':',
      );
    } else if (
      matchday ===
        null
    ) {
      /*
       * Knockout / non-Matchday fixtures
       * remain distinct. Home/Away leg
       * semantics do not apply here.
       */
      key =
        'fixture:' +
        fixture.id;
    } else {
      key =
        fixturePairKey(
          fixture,
          competitionFormat,
          legType,
        );
    }

    canonical.set(
      key,
      selectPreferredFixture(
        canonical.get(
          key,
        ),
        fixture,
      ),
    );
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
