import {
  generateKnockoutFixtures,
  type FixtureBlueprint,
} from './fixture-engine.js';

export type PlayoffFormatValue =
  | 'GLOBAL_SEEDED'
  | 'PROTECTED_SEED'
  | 'DOUBLE_CHANCE';

export type PlayoffSourceOutcome =
  | 'WINNER'
  | 'LOSER';

export interface PlayoffSourceRef {
  key: string;
  outcome: PlayoffSourceOutcome;
}

export interface UniversalPlayoffBlueprint {
  key: string;
  roundNumber: number;
  roundName: string;
  bracketPosition: number;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
  homeSource: PlayoffSourceRef | null;
  awaySource: PlayoffSourceRef | null;
}

export interface UniversalPlayoffPlan {
  format: PlayoffFormatValue;
  fixtures: UniversalPlayoffBlueprint[];
  seedOrder: string[];
  bracketSize: number;
  byeCount: number;
  playInMatches: number;
  eliteSeeds: string[];
  secondChanceMatches: number;
}

export interface SeededBracketPlan {
  seedOrder: string[];
  bracketSlots: Array<string | null>;
  bracketSize: number;
  byeCount: number;
  playInMatches: number;
}

function nextPowerOfTwo(value: number) {
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
}

function seededBranchNumbers(bracketSize: number) {
  let branchSeeds = [1];

  for (
    let size = 2;
    size <= bracketSize / 2;
    size *= 2
  ) {
    branchSeeds = branchSeeds.flatMap(
      (seed) => [
        seed,
        size + 1 - seed,
      ],
    );
  }

  return branchSeeds;
}

export function buildSeededBracketPlan(
  rawSeedOrder: string[],
): SeededBracketPlan {
  if (rawSeedOrder.length < 2) {
    throw new Error(
      'At least two playoff seeds are required.',
    );
  }

  const unique =
    new Set(rawSeedOrder);

  if (unique.size !== rawSeedOrder.length) {
    throw new Error(
      'Playoff seeds must be unique.',
    );
  }

  const seedOrder = [
    ...rawSeedOrder,
  ];

  const bracketSize =
    nextPowerOfTwo(
      seedOrder.length,
    );

  const byeCount =
    bracketSize -
    seedOrder.length;

  const branchSeeds =
    seededBranchNumbers(
      bracketSize,
    );

  const bracketSlots =
    branchSeeds.flatMap(
      (seed) => [
        seedOrder[
          seed - 1
        ] ?? null,

        seedOrder[
          bracketSize -
          seed
        ] ?? null,
      ],
    );

  const entrants =
    bracketSlots.filter(
      (
        id,
      ): id is string =>
        Boolean(id),
    );

  if (
    bracketSlots.length !==
      bracketSize ||
    entrants.length !==
      seedOrder.length ||
    new Set(entrants).size !==
      seedOrder.length
  ) {
    throw new Error(
      'Invalid seeded playoff bracket.',
    );
  }

  return {
    seedOrder,
    bracketSlots,
    bracketSize,
    byeCount,
    playInMatches:
      byeCount > 0
        ? (
            seedOrder.length -
            byeCount
          ) /
          2
        : bracketSize /
          2,
  };
}

function standardBlueprint(
  fixture:
    FixtureBlueprint,
): UniversalPlayoffBlueprint {
  return {
    key:
      fixture.key,
    roundNumber:
      fixture.roundNumber,
    roundName:
      fixture.roundName,
    bracketPosition:
      fixture.bracketPosition,
    homeRegistrationId:
      fixture.homeRegistrationId,
    awayRegistrationId:
      fixture.awayRegistrationId,
    homeSource:
      fixture.homeSourceKey
        ? {
            key:
              fixture.homeSourceKey,
            outcome:
              'WINNER',
          }
        : null,
    awaySource:
      fixture.awaySourceKey
        ? {
            key:
              fixture.awaySourceKey,
            outcome:
              'WINNER',
          }
        : null,
  };
}

function prefixBlueprints(
  fixtures:
    FixtureBlueprint[],
  prefix: string,
  roundOffset: number,
  finalRoundName:
    string | null,
): UniversalPlayoffBlueprint[] {
  const keyMap =
    new Map(
      fixtures.map(
        (
          fixture,
        ) => [
          fixture.key,
          `${prefix}-${fixture.key}`,
        ],
      ),
    );

  const maxRound =
    Math.max(
      ...fixtures.map(
        (fixture) =>
          fixture.roundNumber,
      ),
    );

  return fixtures.map(
    (
      fixture,
    ) => ({
      key:
        keyMap.get(
          fixture.key,
        )!,
      roundNumber:
        fixture.roundNumber +
        roundOffset,
      roundName:
        finalRoundName &&
        fixture.roundNumber ===
          maxRound
          ? finalRoundName
          : fixture.roundNumber ===
              1
            ? 'PLAY-IN'
            : 'ELIMINATION ROUND',
      bracketPosition:
        fixture.bracketPosition,
      homeRegistrationId:
        fixture.homeRegistrationId,
      awayRegistrationId:
        fixture.awayRegistrationId,
      homeSource:
        fixture.homeSourceKey
          ? {
              key:
                keyMap.get(
                  fixture.homeSourceKey,
                )!,
              outcome:
                'WINNER',
            }
          : null,
      awaySource:
        fixture.awaySourceKey
          ? {
              key:
                keyMap.get(
                  fixture.awaySourceKey,
                )!,
              outcome:
                'WINNER',
            }
          : null,
    }),
  );
}

function splitLowerSeeds(
  lowerSeeds:
    string[],
  branches:
    number,
) {
  const result =
    Array.from(
      {
        length:
          branches,
      },
      () =>
        [] as string[],
    );

  lowerSeeds.forEach(
    (
      seed,
      index,
    ) => {
      result[
        index %
        branches
      ]!.push(
        seed,
      );
    },
  );

  return result;
}

function doubleChancePlan(
  seedOrder: string[],
): UniversalPlayoffPlan {
  if (seedOrder.length < 3) {
    throw new Error(
      'Elite Double-Chance requires at least three entries.',
    );
  }

  const unique =
    new Set(
      seedOrder,
    );

  if (
    unique.size !==
    seedOrder.length
  ) {
    throw new Error(
      'Playoff seeds must be unique.',
    );
  }

  const eliteCount =
    seedOrder.length >=
    8
      ? 4
      : 2;

  const eliteSeeds =
    seedOrder.slice(
      0,
      eliteCount,
    );

  const lowerSeeds =
    seedOrder.slice(
      eliteCount,
    );

  const survivorTarget =
    eliteCount /
    2;

  const lowerBranches =
    splitLowerSeeds(
      lowerSeeds,
      survivorTarget,
    );

  const fixtures:
    UniversalPlayoffBlueprint[] =
      [];

  const lowerSurvivors:
    Array<
      | {
          type:
            'registration';
          id:
            string;
        }
      | {
          type:
            'fixture';
          key:
            string;
        }
    > = [];

  let lowerMaxRound =
    0;

  lowerBranches.forEach(
    (
      branch,
      branchIndex,
    ) => {
      if (
        branch.length ===
        0
      ) {
        throw new Error(
          'Elite Double-Chance requires a lower-seed path for every second-chance match.',
        );
      }

      if (
        branch.length ===
        1
      ) {
        lowerSurvivors.push({
          type:
            'registration',
          id:
            branch[0]!,
        });

        return;
      }

      const seeded =
        buildSeededBracketPlan(
          branch,
        );

      const branchFixtures =
        generateKnockoutFixtures(
          branch,
          seeded.bracketSlots,
        );

      const prefixed =
        prefixBlueprints(
          branchFixtures,
          `dc-lower-${
            branchIndex +
            1
          }`,
          0,
          'ELIMINATION FINAL',
        );

      lowerMaxRound =
        Math.max(
          lowerMaxRound,
          ...prefixed.map(
            (fixture) =>
              fixture.roundNumber,
          ),
        );

      fixtures.push(
        ...prefixed,
      );

      const final =
        prefixed.reduce(
          (
            latest,
            fixture,
          ) =>
            fixture.roundNumber >
            latest.roundNumber
              ? fixture
              : latest,
        );

      lowerSurvivors.push({
        type:
          'fixture',
        key:
          final.key,
      });
    },
  );

  const qualificationRound =
    Math.max(
      1,
      lowerMaxRound,
    );

  const qualifyingFixtures:
    UniversalPlayoffBlueprint[] =
      [];

  for (
    let index =
      0;
    index <
      eliteCount /
        2;
    index++
  ) {
    const high =
      eliteSeeds[
        index
      ]!;

    const low =
      eliteSeeds[
        eliteCount -
        1 -
        index
      ]!;

    const fixture:
      UniversalPlayoffBlueprint =
      {
        key:
          `dc-qualifying-${
            index +
            1
          }`,
        roundNumber:
          qualificationRound,
        roundName:
          'QUALIFYING FINAL',
        bracketPosition:
          index +
          1,
        homeRegistrationId:
          high,
        awayRegistrationId:
          low,
        homeSource:
          null,
        awaySource:
          null,
      };

    qualifyingFixtures.push(
      fixture,
    );

    fixtures.push(
      fixture,
    );
  }

  const secondChanceRound =
    qualificationRound +
    1;

  const secondChance:
    UniversalPlayoffBlueprint[] =
      [];

  for (
    let index =
      0;
    index <
      qualifyingFixtures.length;
    index++
  ) {
    const survivor =
      lowerSurvivors[
        index
      ]!;

    const fixture:
      UniversalPlayoffBlueprint =
      {
        key:
          `dc-second-chance-${
            index +
            1
          }`,
        roundNumber:
          secondChanceRound,
        roundName:
          'SECOND CHANCE',
        bracketPosition:
          index +
          1,
        homeRegistrationId:
          null,
        awayRegistrationId:
          survivor.type ===
            'registration'
            ? survivor.id
            : null,
        homeSource: {
          key:
            qualifyingFixtures[
              index
            ]!.key,
          outcome:
            'LOSER',
        },
        awaySource:
          survivor.type ===
            'fixture'
            ? {
                key:
                  survivor.key,
                outcome:
                  'WINNER',
              }
            : null,
      };

    secondChance.push(
      fixture,
    );

    fixtures.push(
      fixture,
    );
  }

  if (
    eliteCount ===
    2
  ) {
    fixtures.push({
      key:
        'dc-final',
      roundNumber:
        secondChanceRound +
        1,
      roundName:
        'FINAL',
      bracketPosition:
        1,
      homeRegistrationId:
        null,
      awayRegistrationId:
        null,
      homeSource: {
        key:
          qualifyingFixtures[
            0
          ]!.key,
        outcome:
          'WINNER',
      },
      awaySource: {
        key:
          secondChance[
            0
          ]!.key,
        outcome:
          'WINNER',
      },
    });
  } else {
    const semifinalRound =
      secondChanceRound +
      1;

    const semifinals:
      UniversalPlayoffBlueprint[] =
      [
        {
          key:
            'dc-semi-1',
          roundNumber:
            semifinalRound,
          roundName:
            'SEMI FINAL',
          bracketPosition:
            1,
          homeRegistrationId:
            null,
          awayRegistrationId:
            null,
          homeSource: {
            key:
              qualifyingFixtures[
                0
              ]!.key,
            outcome:
              'WINNER',
          },
          awaySource: {
            key:
              secondChance[
                1
              ]!.key,
            outcome:
              'WINNER',
          },
        },
        {
          key:
            'dc-semi-2',
          roundNumber:
            semifinalRound,
          roundName:
            'SEMI FINAL',
          bracketPosition:
            2,
          homeRegistrationId:
            null,
          awayRegistrationId:
            null,
          homeSource: {
            key:
              qualifyingFixtures[
                1
              ]!.key,
            outcome:
              'WINNER',
          },
          awaySource: {
            key:
              secondChance[
                0
              ]!.key,
            outcome:
              'WINNER',
          },
        },
      ];

    fixtures.push(
      ...semifinals,
    );

    fixtures.push({
      key:
        'dc-final',
      roundNumber:
        semifinalRound +
        1,
      roundName:
        'FINAL',
      bracketPosition:
        1,
      homeRegistrationId:
        null,
      awayRegistrationId:
        null,
      homeSource: {
        key:
          semifinals[0]!
            .key,
        outcome:
          'WINNER',
      },
      awaySource: {
        key:
          semifinals[1]!
            .key,
        outcome:
          'WINNER',
      },
    });
  }

  const expectedKeys =
    new Set(
      fixtures.map(
        (fixture) =>
          fixture.key,
      ),
    );

  if (
    expectedKeys.size !==
    fixtures.length
  ) {
    throw new Error(
      'Duplicate Elite Double-Chance fixture key.',
    );
  }

  for (
    const fixture
    of fixtures
  ) {
    for (
      const source
      of [
        fixture.homeSource,
        fixture.awaySource,
      ]
    ) {
      if (
        source &&
        !expectedKeys.has(
          source.key,
        )
      ) {
        throw new Error(
          `Unknown Elite Double-Chance source: ${source.key}`,
        );
      }
    }
  }

  return {
    format:
      'DOUBLE_CHANCE',
    fixtures,
    seedOrder: [
      ...seedOrder,
    ],
    bracketSize:
      nextPowerOfTwo(
        seedOrder.length,
      ),
    byeCount:
      eliteCount,
    playInMatches:
      fixtures.filter(
        (fixture) =>
          fixture.roundName ===
          'PLAY-IN',
      ).length,
    eliteSeeds,
    secondChanceMatches:
      secondChance.length,
  };
}

export function buildUniversalPlayoffPlan(
  format:
    PlayoffFormatValue,
  seedOrder:
    string[],
  protectedBracketSlots?:
    Array<string | null>,
): UniversalPlayoffPlan {
  if (
    format ===
    'DOUBLE_CHANCE'
  ) {
    return doubleChancePlan(
      seedOrder,
    );
  }

  const protectedMetrics =
    protectedBracketSlots
      ? Array.from(
          {
            length:
              protectedBracketSlots.length /
              2,
          },
          (
            _,
            index,
          ) => {
            const home =
              protectedBracketSlots[
                index *
                2
              ] ??
              null;

            const away =
              protectedBracketSlots[
                index *
                  2 +
                1
              ] ??
              null;

            return {
              entrants:
                Number(
                  Boolean(
                    home,
                  ),
                ) +
                Number(
                  Boolean(
                    away,
                  ),
                ),
            };
          },
        )
      : null;

  const seeded =
    protectedBracketSlots &&
    protectedMetrics
      ? {
          seedOrder: [
            ...seedOrder,
          ],
          bracketSlots:
            protectedBracketSlots,
          bracketSize:
            protectedBracketSlots.length,
          byeCount:
            protectedMetrics.filter(
              (
                pair,
              ) =>
                pair.entrants ===
                1,
            ).length,
          playInMatches:
            protectedMetrics.filter(
              (
                pair,
              ) =>
                pair.entrants ===
                2,
            ).length,
        }
      : buildSeededBracketPlan(
          seedOrder,
        );

  const generated =
    generateKnockoutFixtures(
      seeded.seedOrder,
      seeded.bracketSlots,
    );

  const actualFirstRound =
    generated.filter(
      (fixture) =>
        fixture.roundNumber ===
        1,
    );

  return {
    format,
    fixtures:
      generated.map(
        standardBlueprint,
      ),
    seedOrder:
      seeded.seedOrder,
    bracketSize:
      seeded.bracketSize,
    byeCount:
      seeded.byeCount,
    playInMatches:
      actualFirstRound.length,
    eliteSeeds:
      seeded.seedOrder.slice(
        0,
        seeded.byeCount,
      ),
    secondChanceMatches:
      0,
  };
}
