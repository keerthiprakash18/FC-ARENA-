import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  generateDoubleRoundRobinFixtures,
  generateKnockoutFixtures,
  generateRoundRobinFixtures,
  type FixtureBlueprint,
} from './fixture-engine.js';


function ids(
  count: number,
  prefix = 'ENTRY',
): string[] {
  return Array.from(
    {
      length:
        count,
    },

    (
      _,
      index,
    ) =>
      `${prefix}-${index + 1}`,
  );
}


function canonicalPair(
  home: string,
  away: string,
) {
  return home <
    away
    ? `${home}:${away}`
    : `${away}:${home}`;
}


function fixturesByRound(
  fixtures:
    FixtureBlueprint[],
) {
  const rounds =
    new Map<
      number,
      FixtureBlueprint[]
    >();

  for (
    const fixture
    of fixtures
  ) {
    const list =
      rounds.get(
        fixture.roundNumber,
      ) ??
      [];

    list.push(
      fixture,
    );

    rounds.set(
      fixture.roundNumber,
      list,
    );
  }

  return rounds;
}


function assertNoSelfMatches(
  fixtures:
    FixtureBlueprint[],
) {
  for (
    const fixture
    of fixtures
  ) {
    expect(
      fixture.homeRegistrationId,
    ).toBeTruthy();

    expect(
      fixture.awayRegistrationId,
    ).toBeTruthy();

    expect(
      fixture.homeRegistrationId,
    ).not.toBe(
      fixture.awayRegistrationId,
    );
  }
}


function assertOneAppearancePerRound(
  fixtures:
    FixtureBlueprint[],
) {
  for (
    const matches
    of fixturesByRound(
      fixtures,
    ).values()
  ) {
    const seen =
      new Set<string>();

    for (
      const fixture
      of matches
    ) {
      const home =
        fixture.homeRegistrationId;

      const away =
        fixture.awayRegistrationId;

      if (
        !home ||
        !away
      ) {
        continue;
      }

      expect(
        seen.has(
          home,
        ),
      ).toBe(
        false,
      );

      expect(
        seen.has(
          away,
        ),
      ).toBe(
        false,
      );

      seen.add(
        home,
      );

      seen.add(
        away,
      );
    }
  }
}


describe(
  'Round Robin Fixture Engine',
  () => {
    it(
      'generates 4-team Single Round correctly',
      () => {
        const participants =
          ids(
            4,
          );

        const fixtures =
          generateRoundRobinFixtures(
            participants,
          );

        expect(
          fixtures,
        ).toHaveLength(
          6,
        );

        expect(
          fixturesByRound(
            fixtures,
          ).size,
        ).toBe(
          3,
        );

        for (
          const matches
          of fixturesByRound(
            fixtures,
          ).values()
        ) {
          expect(
            matches,
          ).toHaveLength(
            2,
          );
        }

        const pairs =
          new Set<string>();

        for (
          const fixture
          of fixtures
        ) {
          const home =
            fixture.homeRegistrationId;

          const away =
            fixture.awayRegistrationId;

          if (
            !home ||
            !away
          ) {
            continue;
          }

          const key =
            canonicalPair(
              home,
              away,
            );

          expect(
            pairs.has(
              key,
            ),
          ).toBe(
            false,
          );

          pairs.add(
            key,
          );
        }

        expect(
          pairs.size,
        ).toBe(
          6,
        );

        assertNoSelfMatches(
          fixtures,
        );

        assertOneAppearancePerRound(
          fixtures,
        );
      },
    );


    it(
      'generates 4-team Home and Away with reversed second legs',
      () => {
        const participants =
          ids(
            4,
          );

        const fixtures =
          generateDoubleRoundRobinFixtures(
            participants,
          );

        expect(
          fixtures,
        ).toHaveLength(
          12,
        );

        expect(
          fixturesByRound(
            fixtures,
          ).size,
        ).toBe(
          6,
        );

        const pairings =
          new Map<
            string,
            Array<
              [string, string]
            >
          >();

        for (
          const fixture
          of fixtures
        ) {
          const home =
            fixture.homeRegistrationId;

          const away =
            fixture.awayRegistrationId;

          if (
            !home ||
            !away
          ) {
            continue;
          }

          const key =
            canonicalPair(
              home,
              away,
            );

          const list =
            pairings.get(
              key,
            ) ??
            [];

          list.push([
            home,
            away,
          ]);

          pairings.set(
            key,
            list,
          );
        }

        expect(
          pairings.size,
        ).toBe(
          6,
        );

        for (
          const pair
          of pairings.values()
        ) {
          expect(
            pair,
          ).toHaveLength(
            2,
          );

          expect(
            pair[0]?.[0],
          ).toBe(
            pair[1]?.[1],
          );

          expect(
            pair[0]?.[1],
          ).toBe(
            pair[1]?.[0],
          );
        }

        assertNoSelfMatches(
          fixtures,
        );

        assertOneAppearancePerRound(
          fixtures,
        );
      },
    );


    it(
      'generates 5-team Single Round with one rotating BYE per Matchday',
      () => {
        const participants =
          ids(
            5,
          );

        const fixtures =
          generateRoundRobinFixtures(
            participants,
          );

        const rounds =
          fixturesByRound(
            fixtures,
          );

        expect(
          fixtures,
        ).toHaveLength(
          10,
        );

        expect(
          rounds.size,
        ).toBe(
          5,
        );

        const byeCounts =
          new Map<
            string,
            number
          >();

        for (
          const matches
          of rounds.values()
        ) {
          expect(
            matches,
          ).toHaveLength(
            2,
          );

          const playing =
            new Set<string>();

          for (
            const fixture
            of matches
          ) {
            if (
              fixture.homeRegistrationId
            ) {
              playing.add(
                fixture.homeRegistrationId,
              );
            }

            if (
              fixture.awayRegistrationId
            ) {
              playing.add(
                fixture.awayRegistrationId,
              );
            }
          }

          const bye =
            participants.filter(
              (
                participant,
              ) =>
                !playing.has(
                  participant,
                ),
            );

          expect(
            bye,
          ).toHaveLength(
            1,
          );

          byeCounts.set(
            bye[0]!,
            (
              byeCounts.get(
                bye[0]!,
              ) ??
              0
            ) +
              1,
          );
        }

        for (
          const participant
          of participants
        ) {
          expect(
            byeCounts.get(
              participant,
            ),
          ).toBe(
            1,
          );
        }

        assertNoSelfMatches(
          fixtures,
        );

        assertOneAppearancePerRound(
          fixtures,
        );
      },
    );


    it(
      'generates 5-team Home and Away with BYEs and reversed legs',
      () => {
        const participants =
          ids(
            5,
          );

        const fixtures =
          generateDoubleRoundRobinFixtures(
            participants,
          );

        expect(
          fixtures,
        ).toHaveLength(
          20,
        );

        expect(
          fixturesByRound(
            fixtures,
          ).size,
        ).toBe(
          10,
        );

        const pairCounts =
          new Map<
            string,
            number
          >();

        for (
          const fixture
          of fixtures
        ) {
          const home =
            fixture.homeRegistrationId;

          const away =
            fixture.awayRegistrationId;

          if (
            !home ||
            !away
          ) {
            continue;
          }

          const key =
            canonicalPair(
              home,
              away,
            );

          pairCounts.set(
            key,
            (
              pairCounts.get(
                key,
              ) ??
              0
            ) +
              1,
          );
        }

        expect(
          pairCounts.size,
        ).toBe(
          10,
        );

        for (
          const count
          of pairCounts.values()
        ) {
          expect(
            count,
          ).toBe(
            2,
          );
        }

        assertNoSelfMatches(
          fixtures,
        );

        assertOneAppearancePerRound(
          fixtures,
        );
      },
    );


    it.each([
      [
        8,
        28,
      ],
      [
        16,
        120,
      ],
      [
        26,
        325,
      ],
    ])(
      'covers every pair exactly once for %i participants',
      (
        participantCount,
        expectedMatches,
      ) => {
        const fixtures =
          generateRoundRobinFixtures(
            ids(
              participantCount,
            ),
          );

        expect(
          fixtures,
        ).toHaveLength(
          expectedMatches,
        );

        const pairs =
          new Set<string>();

        for (
          const fixture
          of fixtures
        ) {
          const home =
            fixture.homeRegistrationId;

          const away =
            fixture.awayRegistrationId;

          if (
            !home ||
            !away
          ) {
            continue;
          }

          const key =
            canonicalPair(
              home,
              away,
            );

          expect(
            pairs.has(
              key,
            ),
          ).toBe(
            false,
          );

          pairs.add(
            key,
          );
        }

        expect(
          pairs.size,
        ).toBe(
          expectedMatches,
        );

        assertNoSelfMatches(
          fixtures,
        );

        assertOneAppearancePerRound(
          fixtures,
        );
      },
    );


    it(
      'supports separate 13-team Tournament groups without cross-group fixtures',
      () => {
        const groupA =
          ids(
            13,
            'A',
          );

        const groupB =
          ids(
            13,
            'B',
          );

        const fixturesA =
          generateRoundRobinFixtures(
            groupA,
          );

        const fixturesB =
          generateRoundRobinFixtures(
            groupB,
          );

        expect(
          fixturesA,
        ).toHaveLength(
          78,
        );

        expect(
          fixturesB,
        ).toHaveLength(
          78,
        );

        expect(
          fixturesByRound(
            fixturesA,
          ).size,
        ).toBe(
          13,
        );

        expect(
          fixturesByRound(
            fixturesB,
          ).size,
        ).toBe(
          13,
        );

        for (
          const fixture
          of fixturesA
        ) {
          expect(
            fixture.homeRegistrationId?.startsWith(
              'A-',
            ),
          ).toBe(
            true,
          );

          expect(
            fixture.awayRegistrationId?.startsWith(
              'A-',
            ),
          ).toBe(
            true,
          );
        }

        for (
          const fixture
          of fixturesB
        ) {
          expect(
            fixture.homeRegistrationId?.startsWith(
              'B-',
            ),
          ).toBe(
            true,
          );

          expect(
            fixture.awayRegistrationId?.startsWith(
              'B-',
            ),
          ).toBe(
            true,
          );
        }
      },
    );
  },
);


describe(
  'Knockout Fixture Engine',
  () => {
    it(
      'creates n - 1 actual fixtures',
      () => {
        expect(
          generateKnockoutFixtures(
            ids(
              2,
            ),
          ),
        ).toHaveLength(
          1,
        );

        expect(
          generateKnockoutFixtures(
            ids(
              5,
            ),
          ),
        ).toHaveLength(
          4,
        );

        expect(
          generateKnockoutFixtures(
            ids(
              8,
            ),
          ),
        ).toHaveLength(
          7,
        );

        expect(
          generateKnockoutFixtures(
            ids(
              20,
            ),
          ),
        ).toHaveLength(
          19,
        );
      },
    );


    it(
      'creates a final round',
      () => {
        const fixtures =
          generateKnockoutFixtures(
            ids(
              8,
            ),
          );

        const finalFixture =
          fixtures.find(
            (
              fixture,
            ) =>
              fixture.roundName ===
              'FINAL',
          );

        expect(
          finalFixture,
        ).toBeDefined();
      },
    );
  },
);
