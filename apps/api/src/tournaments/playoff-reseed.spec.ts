import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  PlayoffsService,
} from './playoffs.service.js';

import {
  buildPlayoffSeedPlan,
} from './playoff-seeding.js';

import {
  buildUniversalPlayoffPlan,
} from './universal-playoff-engine.js';


function setup(
  overrides: {
    playoffFormat?: 'GLOBAL_SEEDED' | 'PROTECTED_SEED' | 'DOUBLE_CHANCE';
    playoffSeedingBasis?: 'AUTO' | 'OVERALL_PERFORMANCE' | 'GROUP_POSITION' | 'MANUAL' | 'RANDOM';
  } = {},
) {
  const groups =
    [
      1,
      2,
    ].map(
      (
        groupNumber,
      ) => ({
        id:
          `g${groupNumber}`,
        name:
          `Group ${groupNumber}`,
        position:
          groupNumber,
      }),
    );


  const entries =
    groups.flatMap(
      (
        group,
      ) =>
        Array.from(
          {
            length:
              6,
          },
          (
            _,
            index,
          ) => ({
            id:
              `${group.position}-${index}`,
            entryName:
              `${group.position}-${index}`,
            groupId:
              group.id,
            sortOrder:
              index,
            createdAt:
              new Date(
                `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
              ),
            standing: {
              points:
                20 -
                index,
              goalDifference:
                10 -
                index,
              goalsFor:
                30 -
                index,
              wins:
                6 -
                index,
            },
            group: {
              position:
                group.position,
            },
          }),
        ),
    );


  const rankedGroups =
    groups.map(
      (
        group,
      ) => ({
        ...group,
        qualifiers:
          entries
            .filter(
              (
                entry,
              ) =>
                entry.groupId ===
                group.id,
            )
            .map(
              (
                entry,
              ) => ({
                id:
                  entry.id,
              }),
            ),
      }),
    );


  const protectedSeedPlan =
    buildPlayoffSeedPlan(
      rankedGroups,
    );


  const oldPlan =
    buildUniversalPlayoffPlan(
      'GLOBAL_SEEDED',
      protectedSeedPlan.seedOrder,
    );


  const old =
    oldPlan.fixtures.map(
      (
        fixture,
        index,
      ) => ({
        id:
          `f${index}`,
        fixtureCode:
          `FCA-F-${index}`,
        tournamentId:
          't',
        groupId:
          null,
        sequence:
          index +
          221,
        roundNumber:
          fixture.roundNumber,
        roundName:
          fixture.roundName,
        bracketPosition:
          fixture.bracketPosition,
        phase:
          'PLAYOFF',
        homeRegistrationId:
          fixture.homeRegistrationId,
        awayRegistrationId:
          fixture.awayRegistrationId,
        nextFixtureId:
          null as string | null,
        nextSlot:
          null as 'HOME' | 'AWAY' | null,
        loserNextFixtureId:
          null as string | null,
        loserNextSlot:
          null as 'HOME' | 'AWAY' | null,
        status:
          'UNSCHEDULED',
        scheduledAt:
          null as Date | null,
        match: {
          id:
            `m${index}`,
          status:
            'UNSCHEDULED',
          confirmedResultSubmissionId:
            null as string | null,
          homeReadyAt:
            null as Date | null,
          awayReadyAt:
            null as Date | null,
          _count: {
            resultSubmissions:
              0,
            statEvents:
              0,
            ocrExtractions:
              0,
            disputes:
              0,
          },
        },
      }),
    );


  const stageCount =
    vi.fn(
      async (
        args: any,
      ) =>
        args?.where?.phase ===
          'STAGE' &&
        args?.where?.status
          ? 0
          : args?.where?.phase ===
              'STAGE'
            ? 220
            : args?.where?.phase ===
                'PLAYOFF'
              ? old.length
              : 0,
    );


  const tx = {
    tournamentRegistration: {
      findMany:
        vi.fn()
          .mockResolvedValue(
            entries,
          ),
    },

    fixture: {
      count:
        vi.fn()
          .mockImplementation(
            stageCount,
          ),

      findMany:
        vi.fn()
          .mockResolvedValue(
            old,
          ),

      update:
        vi.fn()
          .mockResolvedValue(
            {},
          ),
    },

    match: {
      update:
        vi.fn()
          .mockResolvedValue(
            {},
          ),
    },

    auditLog: {
      create:
        vi.fn()
          .mockResolvedValue(
            {},
          ),
    },
  };


  const tournament = {
    id:
      't',
    leagueId:
      'l',
    status:
      'ACTIVE',
    competitionFormat:
      'GROUP_STAGE_KNOCKOUT',
    groupMode:
      'MULTIPLE_GROUPS',
    playoffFormat:
      overrides.playoffFormat ??
      'PROTECTED_SEED',
    playoffSource:
      'GROUP_QUALIFIERS',
    playoffSeedingBasis:
      overrides.playoffSeedingBasis ??
      'GROUP_POSITION',
    qualifiersPerGroup:
      6,
    playoffQualifiersTotal:
      null,
    avoidSameGroupEarly:
      true,
  };


  const prisma = {
    tournament: {
      findUnique:
        vi.fn()
          .mockResolvedValue(
            tournament,
          ),
    },

    tournamentGroup: {
      findMany:
        vi.fn()
          .mockResolvedValue(
            groups,
          ),
    },

    tournamentRegistration: {
      findMany:
        vi.fn()
          .mockResolvedValue(
            entries,
          ),
    },

    fixture: {
      count:
        vi.fn()
          .mockImplementation(
            stageCount,
          ),
    },

    $transactionWithRetry:
      vi.fn(
        async (
          callback:
            (
              client:
                typeof tx,
            ) =>
              Promise<unknown>,
        ) =>
          callback(
            tx,
          ),
      ),
  };


  const authorization = {
    assertCanManageTournament:
      vi.fn()
        .mockResolvedValue(
          undefined,
        ),
  };


  const service =
    new PlayoffsService(
      prisma as never,
      authorization as never,
    );


  return {
    old,
    tx,
    authorization,
    protectedSeedPlan,
    run:
      () =>
        service.generatePlayoffs(
          'owner',
          't',
          {},
          true,
        ),
  };
}


function applyProtectedBracket(
  old:
    ReturnType<
      typeof setup
    >['old'],

  protectedSeedPlan:
    ReturnType<
      typeof setup
    >['protectedSeedPlan'],
) {
  const plan =
    buildUniversalPlayoffPlan(
      'PROTECTED_SEED',
      protectedSeedPlan.seedOrder,
      protectedSeedPlan.bracketSlots,
    );


  const blueprints =
    plan.fixtures.map(
      (
        fixture,
      ) => ({
        ...fixture,
        roundName:
          plan.byeCount >
            0 &&
          fixture.roundNumber ===
            1
            ? 'PLAY-IN'
            : fixture.roundName,
      }),
    );


  const ids =
    new Map<
      string,
      string
    >();


  blueprints.forEach(
    (
      fixture,
      index,
    ) =>
      ids.set(
        fixture.key,
        old[
          index
        ]!.id,
      ),
  );


  blueprints.forEach(
    (
      fixture,
      index,
    ) => {
      Object.assign(
        old[
          index
        ]!,
        {
          homeRegistrationId:
            fixture.homeRegistrationId,
          awayRegistrationId:
            fixture.awayRegistrationId,
          roundName:
            fixture.roundName,
          roundNumber:
            fixture.roundNumber,
          bracketPosition:
            fixture.bracketPosition,
          nextFixtureId:
            null,
          nextSlot:
            null,
          loserNextFixtureId:
            null,
          loserNextSlot:
            null,
        },
      );
    },
  );


  for (
    const fixture
    of blueprints
  ) {
    const targetId =
      ids.get(
        fixture.key,
      )!;

    for (
      const [
        source,
        slot,
      ]
      of [
        [
          fixture.homeSource,
          'HOME',
        ],
        [
          fixture.awaySource,
          'AWAY',
        ],
      ] as const
    ) {
      if (
        !source
      ) {
        continue;
      }

      const sourceId =
        ids.get(
          source.key,
        )!;

      const sourceFixture =
        old.find(
          (
            item,
          ) =>
            item.id ===
            sourceId,
        )!;

      if (
        source.outcome ===
        'WINNER'
      ) {
        sourceFixture.nextFixtureId =
          targetId;

        sourceFixture.nextSlot =
          slot;
      } else {
        sourceFixture.loserNextFixtureId =
          targetId;

        sourceFixture.loserNextSlot =
          slot;
      }
    }
  }
}


describe(
  'Existing playoff reseeding',
  () => {
    it(
      'preserves fixture IDs and audits a protected-bracket rewrite',
      async () => {
        const {
          run,
          tx,
          authorization,
          old,
        } =
          setup();


        const result =
          await run();


        expect(
          result.data.fixtures,
        ).toBe(
          old.length,
        );

        expect(
          result.data.qualifiersPerGroup,
        ).toBe(
          6,
        );

        expect(
          authorization
            .assertCanManageTournament,
        ).toHaveBeenCalledWith(
          'owner',
          't',
        );

        expect(
          tx.fixture.update.mock.calls.every(
            ([
              args,
            ]) =>
              old.some(
                (
                  fixture,
                ) =>
                  fixture.id ===
                  args.where.id,
              ),
          ),
        ).toBe(
          true,
        );

        expect(
          tx.match.update,
        ).toHaveBeenCalledTimes(
          old.length,
        );

        expect(
          tx.auditLog.create,
        ).toHaveBeenCalledOnce();
      },
    );


    it.each([
      'resultSubmissions',
      'statEvents',
      'ocrExtractions',
      'disputes',
    ] as const)(
      'blocks %s activity without writes',
      async (
        field,
      ) => {
        const {
          run,
          old,
          tx,
        } =
          setup();

        old[
          0
        ]!.match._count[
          field
        ] =
          1;


        await expect(
          run(),
        ).rejects.toMatchObject({
          response: {
            error: {
              code:
                'RESEED_ACTIVITY',
            },
          },
        });

        expect(
          tx.fixture.update,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      'blocks started playoff fixtures',
      async () => {
        const {
          run,
          old,
          tx,
        } =
          setup();

        old[
          0
        ]!.status =
          'LIVE';


        await expect(
          run(),
        ).rejects.toMatchObject({
          response: {
            error: {
              code:
                'RESEED_ACTIVITY',
            },
          },
        });

        expect(
          tx.fixture.update,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      'blocks changes to the qualified entry set',
      async () => {
        const {
          run,
          old,
          tx,
        } =
          setup();

        old[
          0
        ]!.homeRegistrationId =
          'other';


        await expect(
          run(),
        ).rejects.toMatchObject({
          response: {
            error: {
              code:
                'RESEED_QUALIFIERS',
            },
          },
        });

        expect(
          tx.fixture.update,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      'is idempotent when the existing bracket already matches protected seeding',
      async () => {
        const {
          run,
          old,
          tx,
          protectedSeedPlan,
        } =
          setup();

        applyProtectedBracket(
          old,
          protectedSeedPlan,
        );


        const result =
          await run();


        expect(
          result.data.message,
        ).toContain(
          'already match',
        );

        expect(
          tx.fixture.update,
        ).not.toHaveBeenCalled();

        expect(
          tx.match.update,
        ).not.toHaveBeenCalled();

        expect(
          tx.auditLog.create,
        ).not.toHaveBeenCalled();
      },
    );


    it.each([
      [
        'stale schedule',
        (
          old:
            ReturnType<
              typeof setup
            >['old'],
        ) => {
          old[
            0
          ]!.scheduledAt =
            new Date();
        },
      ],
      [
        'stale scheduled match status',
        (
          old:
            ReturnType<
              typeof setup
            >['old'],
        ) => {
          old[
            0
          ]!.match.status =
            'SCHEDULED';
        },
      ],
      [
        'home readiness',
        (
          old:
            ReturnType<
              typeof setup
            >['old'],
        ) => {
          old[
            0
          ]!.match.homeReadyAt =
            new Date();
        },
      ],
    ])(
      'normalizes %s and safely reapplies the saved bracket',
      async (
        _label,
        mutate,
      ) => {
        const {
          run,
          old,
          tx,
          protectedSeedPlan,
        } =
          setup();

        applyProtectedBracket(
          old,
          protectedSeedPlan,
        );

        mutate(
          old,
        );


        const result =
          await run();


        expect(
          result.data.message,
        ).toContain(
          'updated',
        );

        expect(
          tx.match.update,
        ).toHaveBeenCalledTimes(
          old.length,
        );

        expect(
          tx.auditLog.create,
        ).toHaveBeenCalledOnce();
      },
    );


    it(
      'rejects random reseed because it would create a new draw',
      async () => {
        const {
          run,
          tx,
        } =
          setup({
            playoffSeedingBasis:
              'RANDOM',
          });


        await expect(
          run(),
        ).rejects.toMatchObject({
          response: {
            error: {
              code:
                'RANDOM_RESEED_NOT_SUPPORTED',
            },
          },
        });

        expect(
          tx.fixture.update,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      'enforces authorization before mutation',
      async () => {
        const {
          run,
          authorization,
          tx,
        } =
          setup();

        authorization
          .assertCanManageTournament
          .mockRejectedValue(
            new Error(
              'Forbidden',
            ),
          );


        await expect(
          run(),
        ).rejects.toThrow(
          'Forbidden',
        );

        expect(
          tx.fixture.update,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
