import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildSeededBracketPlan,
  buildUniversalPlayoffPlan,
} from './universal-playoff-engine.js';

function ids(
  count: number,
) {
  return Array.from(
    {
      length:
        count,
    },
    (
      _,
      index,
    ) =>
      `S${index + 1}`,
  );
}

describe(
  'Universal playoff engine',
  () => {
    it.each([
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      16,
      20,
    ])(
      'creates a seeded single-elimination plan for %i entries',
      (
        count,
      ) => {
        const seeds =
          ids(
            count,
          );

        const seeded =
          buildSeededBracketPlan(
            seeds,
          );

        const plan =
          buildUniversalPlayoffPlan(
            'GLOBAL_SEEDED',
            seeds,
          );

        expect(
          plan.fixtures,
        ).toHaveLength(
          count - 1,
        );

        expect(
          plan.byeCount,
        ).toBe(
          seeded.bracketSize -
            count,
        );

        expect(
          new Set(
            plan.seedOrder,
          ).size,
        ).toBe(
          count,
        );

        expect(
          plan.fixtures.filter(
            (
              fixture,
            ) =>
              fixture.roundName ===
              'FINAL',
          ),
        ).toHaveLength(
          1,
        );
      },
    );

    it(
      'gives the strongest four seeds the four available byes in a 12-entry bracket',
      () => {
        const seeded =
          buildSeededBracketPlan(
            ids(
              12,
            ),
          );

        expect(
          seeded.bracketSize,
        ).toBe(
          16,
        );

        expect(
          seeded.byeCount,
        ).toBe(
          4,
        );

        const byeSeeds =
          seeded.bracketSlots.flatMap(
            (
              seed,
              index,
              slots,
            ) =>
              index %
                  2 ===
                  0 &&
              slots[
                index + 1
              ] ===
                null
                ? [
                    seed,
                  ]
                : [],
          );

        expect(
          byeSeeds.sort(),
        ).toEqual(
          [
            'S1',
            'S2',
            'S3',
            'S4',
          ].sort(),
        );
      },
    );

    it.each([
      [
        3,
        3,
      ],
      [
        4,
        4,
      ],
      [
        5,
        5,
      ],
      [
        6,
        6,
      ],
      [
        8,
        9,
      ],
      [
        10,
        11,
      ],
      [
        12,
        13,
      ],
      [
        16,
        17,
      ],
    ])(
      'creates a complete Elite Double-Chance graph for %i entries',
      (
        count,
        expectedFixtures,
      ) => {
        const plan =
          buildUniversalPlayoffPlan(
            'DOUBLE_CHANCE',
            ids(
              count,
            ),
          );

        expect(
          plan.fixtures,
        ).toHaveLength(
          expectedFixtures,
        );

        expect(
          plan.fixtures.filter(
            (
              fixture,
            ) =>
              fixture.roundName ===
              'FINAL',
          ),
        ).toHaveLength(
          1,
        );

        expect(
          plan.secondChanceMatches,
        ).toBe(
          count >= 8
            ? 2
            : 1,
        );

        const keys =
          new Set(
            plan.fixtures.map(
              (
                fixture,
              ) =>
                fixture.key,
            ),
          );

        for (
          const fixture
          of plan.fixtures
        ) {
          for (
            const source
            of [
              fixture.homeSource,
              fixture.awaySource,
            ]
          ) {
            if (
              source
            ) {
              expect(
                keys.has(
                  source.key,
                ),
              ).toBe(
                true,
              );
            }
          }
        }
      },
    );

    it(
      'routes qualifying-final losers into the second-chance round',
      () => {
        const plan =
          buildUniversalPlayoffPlan(
            'DOUBLE_CHANCE',
            ids(
              12,
            ),
          );

        const secondChance =
          plan.fixtures.filter(
            (
              fixture,
            ) =>
              fixture.roundName ===
              'SECOND CHANCE',
          );

        expect(
          secondChance,
        ).toHaveLength(
          2,
        );

        expect(
          secondChance.every(
            (
              fixture,
            ) =>
              fixture.homeSource
                ?.outcome ===
              'LOSER',
          ),
        ).toBe(
          true,
        );

        expect(
          new Set(
            secondChance.map(
              (
                fixture,
              ) =>
                fixture.homeSource
                  ?.key,
            ),
          ),
        ).toEqual(
          new Set([
            'dc-qualifying-1',
            'dc-qualifying-2',
          ]),
        );
      },
    );

    it(
      'rejects double chance when there are fewer than three entries',
      () => {
        expect(
          () =>
            buildUniversalPlayoffPlan(
              'DOUBLE_CHANCE',
              ids(
                2,
              ),
            ),
        ).toThrow(
          /at least three/i,
        );
      },
    );
  },
);
