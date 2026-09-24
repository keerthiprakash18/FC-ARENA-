import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  generateDoubleRoundRobinFixtures,
} from './fixture-engine.js';
import {
  planLegacyHomeAwayMatchdayRepair,
  type LegacyHomeAwayFixtureLike,
} from './legacy-home-away-matchday-repair.js';


function legacyElevenTeamFixtures() {
  const ids =
    Array.from(
      {
        length:
          11,
      },
      (
        _,
        index,
      ) =>
        `TEAM-${index + 1}`,
    );

  return generateDoubleRoundRobinFixtures(
    ids,
  ).map(
    (
      fixture,
      index,
    ): LegacyHomeAwayFixtureLike => ({
      id:
        `fixture-${index + 1}`,
      groupId:
        null,
      sequence:
        index + 1,
      matchday:
        fixture.matchday &&
        fixture.matchday >
          11
          ? fixture.matchday -
            11
          : fixture.matchday,
      roundNumber:
        fixture.roundNumber >
          11
          ? fixture.roundNumber -
            11
          : fixture.roundNumber,
      roundName:
        `Matchday ${
          fixture.matchday &&
          fixture.matchday >
            11
            ? fixture.matchday -
              11
            : fixture.matchday
        }`,
      homeRegistrationId:
        fixture.homeRegistrationId,
      awayRegistrationId:
        fixture.awayRegistrationId,
    }),
  );
}


describe(
  'legacy Home & Away Matchday repair',
  () => {
    it(
      'repairs only the second leg of an 11-team 110-fixture schedule',
      () => {
        const fixtures =
          legacyElevenTeamFixtures();

        const updates =
          planLegacyHomeAwayMatchdayRepair(
            fixtures,
            'LEAGUE_ROUND_ROBIN',
            'HOME_AWAY',
          );

        expect(
          updates,
        ).toHaveLength(
          55,
        );

        expect(
          Math.min(
            ...updates.map(
              (update) =>
                update.matchday ??
                0,
            ),
          ),
        ).toBe(
          12,
        );

        expect(
          Math.max(
            ...updates.map(
              (update) =>
                update.matchday ??
                0,
            ),
          ),
        ).toBe(
          22,
        );

        const repaired =
          fixtures.map(
            (
              fixture,
            ) =>
              updates.find(
                (
                  update,
                ) =>
                  update.id ===
                  fixture.id,
              ) ??
              fixture,
          );

        expect(
          new Set(
            repaired.map(
              (fixture) =>
                fixture.matchday,
            ),
          ).size,
        ).toBe(
          22,
        );
      },
    );


    it(
      'does nothing when the 22 Matchdays are already correct',
      () => {
        const fixtures =
          legacyElevenTeamFixtures();

        const first =
          planLegacyHomeAwayMatchdayRepair(
            fixtures,
            'LEAGUE_ROUND_ROBIN',
            'HOME_AWAY',
          );

        const repaired =
          fixtures.map(
            (
              fixture,
            ) => {
              const update =
                first.find(
                  (
                    item,
                  ) =>
                    item.id ===
                    fixture.id,
                );

              return update
                ? {
                    ...fixture,
                    ...update,
                  }
                : fixture;
            },
          );

        expect(
          planLegacyHomeAwayMatchdayRepair(
            repaired,
            'LEAGUE_ROUND_ROBIN',
            'HOME_AWAY',
          ),
        ).toEqual(
          [],
        );
      },
    );


    it(
      'refuses to repair an incomplete or non Home & Away fixture set',
      () => {
        const fixtures =
          legacyElevenTeamFixtures();

        expect(
          planLegacyHomeAwayMatchdayRepair(
            fixtures.slice(
              0,
              -1,
            ),
            'LEAGUE_ROUND_ROBIN',
            'HOME_AWAY',
          ),
        ).toEqual(
          [],
        );

        expect(
          planLegacyHomeAwayMatchdayRepair(
            fixtures,
            'LEAGUE_ROUND_ROBIN',
            'SINGLE_LEG',
          ),
        ).toEqual(
          [],
        );
      },
    );
  },
);
