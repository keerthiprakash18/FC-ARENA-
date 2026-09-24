export interface StandingsRegistrationScope {
  id: string;
  groupId?: string | null;
}

export interface StandingsFixtureLike {
  id: string;
  groupId?: string | null;
  sequence?: number | null;
  matchday?: number | null;
  roundNumber?: number | null;
  homeRegistrationId?: string | null;
  awayRegistrationId?: string | null;
}

export interface StandingsIntegrityOptions {
  competitionFormat?: string | null;
  legType?: string | null;
  tournamentFormat?: string | null;
  hasGroups: boolean;
}

export function roundRobinRoundsPerLeg(
  participantCount: number,
) {
  if (participantCount < 2) {
    return 0;
  }

  return participantCount % 2 === 0
    ? participantCount - 1
    : participantCount;
}

function fixtureMatchday(
  fixture: StandingsFixtureLike,
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

export function canonicalizeRoundRobinStandingsFixtures<
  T extends StandingsFixtureLike,
>(
  fixtures: T[],
  registrations:
    StandingsRegistrationScope[],
  options:
    StandingsIntegrityOptions,
) {
  if (
    options.tournamentFormat ===
    'KNOCKOUT'
  ) {
    return [] as T[];
  }

  const registrationGroup =
    new Map(
      registrations.map(
        (registration) => [
          registration.id,
          registration.groupId ??
            null,
        ],
      ),
    );

  const groupSizes =
    new Map<string, number>();

  for (
    const registration
    of registrations
  ) {
    const scope =
      registration.groupId ??
      '__NO_GROUP__';

    groupSizes.set(
      scope,
      (
        groupSizes.get(
          scope,
        ) ?? 0
      ) + 1,
    );
  }

  const ordered =
    [...fixtures].sort(
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

  const accepted: T[] = [];
  const seenParticipantMatchday =
    new Set<string>();
  const seenPairLeg =
    new Set<string>();

  const homeAway =
    options.competitionFormat ===
      'DOUBLE_ROUND_ROBIN' ||
    options.legType ===
      'HOME_AWAY';

  for (
    const fixture
    of ordered
  ) {
    const home =
      fixture.homeRegistrationId;
    const away =
      fixture.awayRegistrationId;

    if (
      !home ||
      !away ||
      home === away
    ) {
      continue;
    }

    if (
      options.hasGroups
    ) {
      if (!fixture.groupId) {
        continue;
      }

      if (
        registrationGroup.get(
          home,
        ) !==
          fixture.groupId ||
        registrationGroup.get(
          away,
        ) !==
          fixture.groupId
      ) {
        continue;
      }
    }

    if (
      options.competitionFormat ===
      'CUSTOM_MANUAL'
    ) {
      accepted.push(
        fixture,
      );

      continue;
    }

    const scope =
      options.hasGroups
        ? fixture.groupId ??
          '__INVALID_GROUP__'
        : '__LEAGUE__';

    const matchday =
      fixtureMatchday(
        fixture,
      );

    const homeMatchdayKey =
      matchday === null
        ? null
        : `${scope}:${matchday}:${home}`;

    const awayMatchdayKey =
      matchday === null
        ? null
        : `${scope}:${matchday}:${away}`;

    if (
      (
        homeMatchdayKey &&
        seenParticipantMatchday.has(
          homeMatchdayKey,
        )
      ) ||
      (
        awayMatchdayKey &&
        seenParticipantMatchday.has(
          awayMatchdayKey,
        )
      )
    ) {
      continue;
    }

    const pair =
      [home, away].sort();

    let pairKey =
      `${scope}:${pair[0]}:${pair[1]}`;

    if (homeAway) {
      const participantCount =
        options.hasGroups
          ? groupSizes.get(
              fixture.groupId ??
                '__NO_GROUP__',
            ) ?? 0
          : registrations.length;

      const roundsPerLeg =
        roundRobinRoundsPerLeg(
          participantCount,
        );

      if (
        matchday !== null &&
        roundsPerLeg > 0
      ) {
        const leg =
          matchday <=
          roundsPerLeg
            ? 1
            : 2;

        pairKey +=
          `:LEG:${leg}`;
      } else {
        pairKey +=
          `:DIR:${home}:${away}`;
      }
    }

    if (
      seenPairLeg.has(
        pairKey,
      )
    ) {
      continue;
    }

    seenPairLeg.add(
      pairKey,
    );

    if (
      homeMatchdayKey
    ) {
      seenParticipantMatchday.add(
        homeMatchdayKey,
      );
    }

    if (
      awayMatchdayKey
    ) {
      seenParticipantMatchday.add(
        awayMatchdayKey,
      );
    }

    accepted.push(
      fixture,
    );
  }

  return accepted;
}
