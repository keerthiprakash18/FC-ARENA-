export interface FixtureBlueprint {
  key: string;
  roundNumber: number;
  roundName: string;
  matchday: number | null;
  bracketPosition: number;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
  homeSourceKey: string | null;
  awaySourceKey: string | null;
}

interface RegistrationSlot {
  type: 'registration';
  id: string;
}

interface FixtureSlot {
  type: 'fixture';
  key: string;
}

type KnockoutSlot = RegistrationSlot | FixtureSlot;

export function generateRoundRobinFixtures(
  registrationIds: string[],
): FixtureBlueprint[] {
  if (registrationIds.length < 2) {
    throw new Error(
      'At least 2 entries are required for Round Robin.',
    );
  }

  const participants: Array<string | null> = [
    ...registrationIds,
  ];

  if (participants.length % 2 !== 0) {
    participants.push(null);
  }

  const totalSlots = participants.length;
  const rounds = totalSlots - 1;
  const matchesPerRound = totalSlots / 2;

  const rotating = [...participants];
  const fixtures: FixtureBlueprint[] = [];

  let sequence = 1;

  for (
    let roundIndex = 0;
    roundIndex < rounds;
    roundIndex++
  ) {
    for (
      let matchIndex = 0;
      matchIndex < matchesPerRound;
      matchIndex++
    ) {
      const left = rotating[matchIndex];
      const right =
        rotating[totalSlots - 1 - matchIndex];

      if (left === null || right === null) {
        continue;
      }

      const alternate =
        (roundIndex + matchIndex) % 2 === 0;

      const homeRegistrationId = alternate
        ? left
        : right;

      const awayRegistrationId = alternate
        ? right
        : left;

      fixtures.push({
        key: `rr-${sequence}`,
        roundNumber: roundIndex + 1,
        roundName: `MATCHDAY ${roundIndex + 1}`,
        matchday: roundIndex + 1,
        bracketPosition: matchIndex + 1,
        homeRegistrationId,
        awayRegistrationId,
        homeSourceKey: null,
        awaySourceKey: null,
      });

      sequence++;
    }

    const fixed = rotating[0];
    const last = rotating[rotating.length - 1];

    rotating.splice(rotating.length - 1, 1);
    rotating.splice(1, 0, last);
    rotating[0] = fixed;
  }

  validateRoundRobin(
    registrationIds,
    fixtures,
  );

  return fixtures;
}


export function generateDoubleRoundRobinFixtures(
  registrationIds: string[],
): FixtureBlueprint[] {
  const firstLeg =
    generateRoundRobinFixtures(
      registrationIds,
    );

  const rounds =
    registrationIds.length % 2 === 0
      ? registrationIds.length - 1
      : registrationIds.length;

  const secondLeg =
    firstLeg.map(
      (
        fixture,
        index,
      ) => ({
        ...fixture,

        key:
          `drr-${index + 1}`,

        roundNumber:
          fixture.roundNumber +
          rounds,

        roundName:
          `MATCHDAY ${
            fixture.roundNumber +
            rounds
          }`,

        matchday:
          fixture.matchday === null
            ? null
            : fixture.matchday +
              rounds,

        homeRegistrationId:
          fixture.awayRegistrationId,

        awayRegistrationId:
          fixture.homeRegistrationId,
      }),
    );

  const fixtures = [
    ...firstLeg.map(
      (
        fixture,
        index,
      ) => ({
        ...fixture,

        key:
          `drr-first-${index + 1}`,
      }),
    ),

    ...secondLeg,
  ];

  const expected =
    registrationIds.length *
    (registrationIds.length - 1);

  if (
    fixtures.length !==
    expected
  ) {
    throw new Error(
      `Invalid Double Round Robin fixture count. Expected ${expected}, received ${fixtures.length}.`,
    );
  }

  return fixtures;
}

export function generateKnockoutFixtures(
  registrationIds: string[],
): FixtureBlueprint[] {
  if (registrationIds.length < 2) {
    throw new Error(
      'At least 2 entries are required for Knockout.',
    );
  }

  const bracketSize =
    nextPowerOfTwo(registrationIds.length);

  const byeCount =
    bracketSize - registrationIds.length;

  const fixtures: FixtureBlueprint[] = [];

  let entryIndex = 0;
  let firstRoundFixturePosition = 1;

  const advancers: KnockoutSlot[] = [];

  for (
    let branchIndex = 0;
    branchIndex < bracketSize / 2;
    branchIndex++
  ) {
    if (branchIndex < byeCount) {
      const registrationId =
        registrationIds[entryIndex];

      if (!registrationId) {
        throw new Error(
          'Invalid Knockout bracket state.',
        );
      }

      advancers.push({
        type: 'registration',
        id: registrationId,
      });

      entryIndex++;

      continue;
    }

    const homeRegistrationId =
      registrationIds[entryIndex];

    const awayRegistrationId =
      registrationIds[entryIndex + 1];

    if (
      !homeRegistrationId ||
      !awayRegistrationId
    ) {
      throw new Error(
        'Invalid Knockout bracket pairing.',
      );
    }

    const key = `ko-r1-f${firstRoundFixturePosition}`;

    fixtures.push({
      key,
      roundNumber: 1,
      roundName:
        getKnockoutRoundName(bracketSize),
      matchday: null,
      bracketPosition:
        firstRoundFixturePosition,
      homeRegistrationId,
      awayRegistrationId,
      homeSourceKey: null,
      awaySourceKey: null,
    });

    advancers.push({
      type: 'fixture',
      key,
    });

    entryIndex += 2;
    firstRoundFixturePosition++;
  }

  let currentAdvancers = advancers;
  let roundNumber = 2;

  while (currentAdvancers.length > 1) {
    const nextAdvancers: KnockoutSlot[] = [];

    const participantCount =
      currentAdvancers.length;

    for (
      let index = 0;
      index < currentAdvancers.length;
      index += 2
    ) {
      const homeSlot = currentAdvancers[index];
      const awaySlot =
        currentAdvancers[index + 1];

      if (!homeSlot || !awaySlot) {
        throw new Error(
          'Invalid Knockout progression.',
        );
      }

      const bracketPosition =
        index / 2 + 1;

      const key =
        `ko-r${roundNumber}-f${bracketPosition}`;

      fixtures.push({
        key,
        roundNumber,
        roundName:
          getKnockoutRoundName(
            participantCount,
          ),
        matchday: null,
        bracketPosition,

        homeRegistrationId:
          homeSlot.type === 'registration'
            ? homeSlot.id
            : null,

        awayRegistrationId:
          awaySlot.type === 'registration'
            ? awaySlot.id
            : null,

        homeSourceKey:
          homeSlot.type === 'fixture'
            ? homeSlot.key
            : null,

        awaySourceKey:
          awaySlot.type === 'fixture'
            ? awaySlot.key
            : null,
      });

      nextAdvancers.push({
        type: 'fixture',
        key,
      });
    }

    currentAdvancers = nextAdvancers;
    roundNumber++;
  }

  if (
    fixtures.length !==
    registrationIds.length - 1
  ) {
    throw new Error(
      `Invalid Knockout fixture count. Expected ${
        registrationIds.length - 1
      }, received ${fixtures.length}.`,
    );
  }

  return fixtures;
}

function validateRoundRobin(
  registrationIds: string[],
  fixtures: FixtureBlueprint[],
): void {
  const expected =
    (registrationIds.length *
      (registrationIds.length - 1)) /
    2;

  if (fixtures.length !== expected) {
    throw new Error(
      `Invalid Round Robin fixture count. Expected ${expected}, received ${fixtures.length}.`,
    );
  }

  const pairs = new Set<string>();

  for (const fixture of fixtures) {
    const home = fixture.homeRegistrationId;
    const away = fixture.awayRegistrationId;

    if (!home || !away) {
      throw new Error(
        'Round Robin fixture cannot contain a BYE.',
      );
    }

    if (home === away) {
      throw new Error(
        'A participant cannot play itself.',
      );
    }

    const key = [home, away]
      .sort()
      .join(':');

    if (pairs.has(key)) {
      throw new Error(
        `Duplicate Round Robin pair detected: ${key}`,
      );
    }

    pairs.add(key);
  }
}

function nextPowerOfTwo(value: number): number {
  let result = 1;

  while (result < value) {
    result *= 2;
  }

  return result;
}

function getKnockoutRoundName(
  participantCount: number,
): string {
  switch (participantCount) {
    case 2:
      return 'FINAL';

    case 4:
      return 'SEMI FINAL';

    case 8:
      return 'QUARTER FINAL';

    case 16:
      return 'ROUND OF 16';

    case 32:
      return 'ROUND OF 32';

    case 64:
      return 'ROUND OF 64';

    case 128:
      return 'ROUND OF 128';

    default:
      return `ROUND OF ${participantCount}`;
  }
}