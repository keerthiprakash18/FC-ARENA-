export interface LegacyHomeAwayFixtureLike {
  id: string;
  groupId: string | null;
  sequence: number;
  matchday: number | null;
  roundNumber: number;
  roundName: string;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
}

export interface LegacyHomeAwayMatchdayUpdate {
  id: string;
  matchday: number | null;
  roundNumber: number;
  roundName: string;
}


function pairKey(
  home: string,
  away: string,
) {
  return [
    home,
    away,
  ]
    .sort()
    .join(':');
}


function isCompleteRange(
  values: number[],
  max: number,
) {
  const unique =
    [
      ...new Set(
        values,
      ),
    ].sort(
      (
        first,
        second,
      ) =>
        first -
        second,
    );

  return (
    unique.length ===
      max &&
    unique.every(
      (
        value,
        index,
      ) =>
        value ===
        index +
          1,
    )
  );
}


function oneAppearancePerNumber(
  fixtures: LegacyHomeAwayFixtureLike[],
  getNumber:
    (
      fixture:
        LegacyHomeAwayFixtureLike,
    ) => number | null,
) {
  const seen =
    new Set<string>();

  for (
    const fixture
    of fixtures
  ) {
    const number =
      getNumber(
        fixture,
      );

    const home =
      fixture.homeRegistrationId;

    const away =
      fixture.awayRegistrationId;

    if (
      number ===
        null ||
      !home ||
      !away
    ) {
      return false;
    }

    for (
      const participant
      of [
        home,
        away,
      ]
    ) {
      const key =
        `${number}:${participant}`;

      if (
        seen.has(
          key,
        )
      ) {
        return false;
      }

      seen.add(
        key,
      );
    }
  }

  return true;
}


function replaceTrailingNumber(
  value: string,
  number: number,
) {
  return /\d+\s*$/.test(
    value,
  )
    ? value.replace(
        /\d+\s*$/,
        String(
          number,
        ),
      )
    : value;
}


export function planLegacyHomeAwayMatchdayRepair(
  fixtures:
    LegacyHomeAwayFixtureLike[],
  competitionFormat?:
    string | null,
  legType?:
    string | null,
): LegacyHomeAwayMatchdayUpdate[] {
  const isHomeAway =
    competitionFormat ===
      'DOUBLE_ROUND_ROBIN' ||
    legType ===
      'HOME_AWAY';

  if (!isHomeAway) {
    return [];
  }

  const scopes =
    new Map<
      string,
      LegacyHomeAwayFixtureLike[]
    >();

  for (
    const fixture
    of fixtures
  ) {
    const key =
      fixture.groupId ??
      'NO_GROUP';

    const list =
      scopes.get(
        key,
      ) ??
      [];

    list.push(
      fixture,
    );

    scopes.set(
      key,
      list,
    );
  }

  const updates:
    LegacyHomeAwayMatchdayUpdate[] =
    [];

  for (
    const scope
    of scopes.values()
  ) {
    if (
      scope.some(
        (
          fixture,
        ) =>
          !fixture.homeRegistrationId ||
          !fixture.awayRegistrationId,
      )
    ) {
      continue;
    }

    const participants =
      new Set<string>();

    for (
      const fixture
      of scope
    ) {
      participants.add(
        fixture.homeRegistrationId!,
      );
      participants.add(
        fixture.awayRegistrationId!,
      );
    }

    const participantCount =
      participants.size;

    if (
      participantCount <
      2
    ) {
      continue;
    }

    const roundsPerLeg =
      participantCount %
      2 ===
      0
        ? participantCount -
          1
        : participantCount;

    const fixturesPerLeg =
      (
        participantCount *
        (
          participantCount -
          1
        )
      ) /
      2;

    const expectedFixtures =
      fixturesPerLeg *
      2;

    if (
      scope.length !==
      expectedFixtures
    ) {
      continue;
    }

    const ordered =
      [
        ...scope,
      ].sort(
        (
          first,
          second,
        ) =>
          first.sequence -
          second.sequence,
      );

    const firstLeg =
      ordered.slice(
        0,
        fixturesPerLeg,
      );

    const secondLeg =
      ordered.slice(
        fixturesPerLeg,
      );

    const firstPairs =
      new Map<
        string,
        LegacyHomeAwayFixtureLike
      >();

    let validPairing =
      true;

    for (
      const fixture
      of firstLeg
    ) {
      const home =
        fixture.homeRegistrationId!;
      const away =
        fixture.awayRegistrationId!;
      const key =
        pairKey(
          home,
          away,
        );

      if (
        home ===
          away ||
        firstPairs.has(
          key,
        )
      ) {
        validPairing =
          false;
        break;
      }

      firstPairs.set(
        key,
        fixture,
      );
    }

    if (
      !validPairing ||
      firstPairs.size !==
        fixturesPerLeg
    ) {
      continue;
    }

    const secondPairs =
      new Set<string>();

    for (
      const fixture
      of secondLeg
    ) {
      const home =
        fixture.homeRegistrationId!;
      const away =
        fixture.awayRegistrationId!;
      const key =
        pairKey(
          home,
          away,
        );
      const first =
        firstPairs.get(
          key,
        );

      if (
        home ===
          away ||
        secondPairs.has(
          key,
        ) ||
        !first ||
        first.homeRegistrationId !==
          away ||
        first.awayRegistrationId !==
          home
      ) {
        validPairing =
          false;
        break;
      }

      secondPairs.add(
        key,
      );
    }

    if (
      !validPairing ||
      secondPairs.size !==
        fixturesPerLeg
    ) {
      continue;
    }

    const matchdayValues =
      scope
        .map(
          (
            fixture,
          ) =>
            fixture.matchday,
        )
        .filter(
          (
            value,
          ): value is number =>
            typeof value ===
            'number',
        );

    const needsMatchdayRepair =
      matchdayValues.length ===
        scope.length &&
      isCompleteRange(
        matchdayValues,
        roundsPerLeg,
      );

    const needsRoundRepair =
      isCompleteRange(
        scope.map(
          (
            fixture,
          ) =>
            fixture.roundNumber,
        ),
        roundsPerLeg,
      );

    if (
      !needsMatchdayRepair &&
      !needsRoundRepair
    ) {
      continue;
    }

    if (
      needsMatchdayRepair &&
      (
        !oneAppearancePerNumber(
          firstLeg,
          (
            fixture,
          ) =>
            fixture.matchday,
        ) ||
        !oneAppearancePerNumber(
          secondLeg,
          (
            fixture,
          ) =>
            fixture.matchday,
        )
      )
    ) {
      continue;
    }

    if (
      needsRoundRepair &&
      (
        !oneAppearancePerNumber(
          firstLeg,
          (
            fixture,
          ) =>
            fixture.roundNumber,
        ) ||
        !oneAppearancePerNumber(
          secondLeg,
          (
            fixture,
          ) =>
            fixture.roundNumber,
        )
      )
    ) {
      continue;
    }

    for (
      const fixture
      of secondLeg
    ) {
      const matchday =
        needsMatchdayRepair &&
        fixture.matchday !==
          null
          ? fixture.matchday +
            roundsPerLeg
          : fixture.matchday;

      const roundNumber =
        needsRoundRepair
          ? fixture.roundNumber +
            roundsPerLeg
          : fixture.roundNumber;

      const displayNumber =
        matchday ??
        roundNumber;

      updates.push({
        id:
          fixture.id,
        matchday,
        roundNumber,
        roundName:
          replaceTrailingNumber(
            fixture.roundName,
            displayNumber,
          ),
      });
    }
  }

  return updates;
}
