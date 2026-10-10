import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomInt,
  randomUUID,
} from 'node:crypto';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  AuthorizationService,
} from '../security/authorization.service.js';

import type {
  GeneratePlayoffsDto,
} from './dto/generate-playoffs.dto.js';

import {
  buildPlayoffSeedPlan,
} from './playoff-seeding.js';

import {
  buildUniversalPlayoffPlan,
  type PlayoffSourceRef,
  type UniversalPlayoffBlueprint,
} from './universal-playoff-engine.js';


interface RankedEntry {
  id: string;
  entryName: string;
  groupId: string | null;
  groupPosition: number | null;
  sortOrder: number;
  createdAt: Date;
  points: number;
  goalDifference: number;
  goalsFor: number;
  wins: number;
}

interface RankedGroup {
  id: string;
  name: string;
  position: number;
  qualifiers: RankedEntry[];
}

interface ReseedFixtureRecord {
  id: string;
  fixtureCode: string;
  phase: string;
  sequence: number;
  status: string;
  scheduledAt: Date | null;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
  roundNumber: number;
  roundName: string;
  bracketPosition: number;
  nextFixtureId: string | null;
  nextSlot: 'HOME' | 'AWAY' | null;
  loserNextFixtureId: string | null;
  loserNextSlot: 'HOME' | 'AWAY' | null;
  match: {
    status: string;
    confirmedResultSubmissionId: string | null;
    homeReadyAt: Date | null;
    awayReadyAt: Date | null;
    _count: {
      resultSubmissions: number;
      statEvents: number;
      ocrExtractions: number;
      disputes: number;
    };
  } | null;
}


@Injectable()
export class PlayoffsService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly authorization:
      AuthorizationService,
  ) {}


  async generatePlayoffs(
    userId: string,
    tournamentId: string,
    dto: GeneratePlayoffsDto,
    reseed = false,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id:
            tournamentId,
        },
      });


    if (!tournament) {
      throw this.tournamentNotFound();
    }


    await this.authorization.assertCanManageTournament(
      userId,
      tournamentId,
    );


    if (
      ![
        'GROUP_STAGE_KNOCKOUT',
        'SINGLE_ELIMINATION',
      ].includes(
        tournament.competitionFormat,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'PLAYOFFS_NOT_CONFIGURED',
          message:
            'This Tournament format does not include a playoff stage.',
        },
      });
    }


    if (
      reseed &&
      tournament.playoffSeedingBasis ===
        'RANDOM'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RANDOM_RESEED_NOT_SUPPORTED',
          message:
            'Random seeding cannot be reapplied safely because it would create a new draw. Reset the playoff preview and generate a new random draw instead.',
        },
      });
    }


    if (
      tournament.competitionFormat ===
      'GROUP_STAGE_KNOCKOUT'
    ) {
      await this.assertStageComplete(
        tournamentId,
      );
    }


    const [
      groups,
      approvedEntries,
      existingPlayoffs,
    ] =
      await Promise.all([
        this.prisma.tournamentGroup.findMany({
          where: {
            tournamentId,
          },
          orderBy: {
            position:
              'asc',
          },
          select: {
            id: true,
            name: true,
            position: true,
          },
        }),

        this.loadApprovedEntries(
          this.prisma,
          tournamentId,
        ),

        this.prisma.fixture.count({
          where: {
            tournamentId,
            phase:
              'PLAYOFF',
          },
        }),
      ]);


    if (
      existingPlayoffs >
        0 &&
      !reseed
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'PLAYOFFS_ALREADY_GENERATED',
          message:
            'Playoff fixtures have already been generated.',
        },
      });
    }


    if (
      approvedEntries.length <
      2
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'NOT_ENOUGH_PLAYOFF_ENTRIES',
          message:
            'At least two approved Tournament entries are required.',
        },
      });
    }


    const source =
      this.resolvePlayoffSource(
        tournament.playoffSource,
        tournament.competitionFormat,
        tournament.groupMode,
        groups.length,
      );


    const qualification =
      this.buildQualification(
        {
          source,
          tournament,
          groups,
          entries:
            approvedEntries,
          dto,
        },
      );


    const seedOrder =
      this.resolveSeedOrder(
        {
          entries:
            qualification.entries,
          groups:
            qualification.groups,
          seedingBasis:
            tournament.playoffSeedingBasis,
          format:
            tournament.playoffFormat,
          source,
        },
      );


    let protectedSlots:
      Array<
        string |
        null
      > |
      undefined;


    if (
      tournament.playoffFormat ===
        'PROTECTED_SEED' &&
      qualification.groups.length >
        1 &&
      (
        tournament.playoffSeedingBasis ===
          'AUTO' ||
        tournament.playoffSeedingBasis ===
          'GROUP_POSITION'
      )
    ) {
      const protectedPlan =
        buildPlayoffSeedPlan(
          qualification.groups.map(
            (
              group,
            ) => ({
              id:
                group.id,
              position:
                group.position,
              qualifiers:
                group.qualifiers.map(
                  (
                    entry,
                  ) => ({
                    id:
                      entry.id,
                  }),
                ),
            }),
          ),
        );

      protectedSlots =
        protectedPlan.bracketSlots;
    }


    const rawPlan =
      buildUniversalPlayoffPlan(
        tournament.playoffFormat,
        seedOrder,
        protectedSlots,
      );


    const blueprints =
      rawPlan.fixtures.map(
        (
          blueprint,
        ) => ({
          ...blueprint,
          roundName:
            rawPlan.byeCount >
              0 &&
            blueprint.roundNumber ===
              1 &&
            ![
              'DOUBLE_CHANCE',
            ].includes(
              tournament.playoffFormat,
            )
              ? 'PLAY-IN'
              : blueprint.roundName,
        }),
      );


    const fingerprint =
      this.entryFingerprint(
        approvedEntries,
      );


    const operation =
      await this.prisma.$transactionWithRetry(
        async (
          tx,
        ) => {
          const currentEntries =
            await this.loadApprovedEntries(
              tx,
              tournamentId,
            );


          if (
            this.entryFingerprint(
              currentEntries,
            ) !==
            fingerprint
          ) {
            throw new ConflictException({
              success: false,
              data: null,
              error: {
                code:
                  'QUALIFICATION_CHANGED',
                message:
                  'Entries, groups or standings changed while playoffs were being prepared. Recheck the playoff preview.',
              },
            });
          }


          if (
            tournament.competitionFormat ===
            'GROUP_STAGE_KNOCKOUT'
          ) {
            const incomplete =
              await tx.fixture.count({
                where: {
                  tournamentId,
                  phase:
                    'STAGE',
                  status: {
                    not:
                      'COMPLETED',
                  },
                },
              });


            if (
              incomplete >
              0
            ) {
              throw new ConflictException({
                success: false,
                data: null,
                error: {
                  code:
                    'STAGE_CHANGED',
                  message:
                    'Stage fixtures changed before playoff generation. Complete the stage first.',
                },
              });
            }
          }


          if (
            reseed
          ) {
            return this.reseedExisting(
              tx,
              {
                userId,
                tournamentId,
                blueprints,
                seedOrder,
              },
            );
          }


          const existing =
            await tx.fixture.count({
              where: {
                tournamentId,
                phase:
                  'PLAYOFF',
              },
            });


          if (
            existing >
            0
          ) {
            throw new ConflictException({
              success: false,
              data: null,
              error: {
                code:
                  'PLAYOFFS_ALREADY_GENERATED',
                message:
                  'Playoff fixtures have already been generated.',
              },
            });
          }


          const latestFixture =
            await tx.fixture.findFirst({
              where: {
                tournamentId,
              },
              orderBy: {
                sequence:
                  'desc',
              },
              select: {
                sequence:
                  true,
              },
            });


          let sequence =
            (
              latestFixture
                ?.sequence ??
              0
            ) +
            1;


          const fixtureIds =
            new Map<
              string,
              string
            >();


          for (
            const blueprint
            of blueprints
          ) {
            const fixture =
              await tx.fixture.create({
                data: {
                  fixtureCode:
                    this.createFixtureCode(),
                  tournamentId,
                  groupId:
                    null,
                  sequence,
                  matchday:
                    null,
                  roundNumber:
                    blueprint.roundNumber,
                  roundName:
                    blueprint.roundName,
                  bracketPosition:
                    blueprint.bracketPosition,
                  phase:
                    'PLAYOFF',
                  homeRegistrationId:
                    blueprint.homeRegistrationId,
                  awayRegistrationId:
                    blueprint.awayRegistrationId,
                },
              });


            await this.createMatchForFixture(
              tx,
              tournamentId,
              fixture.id,
            );


            fixtureIds.set(
              blueprint.key,
              fixture.id,
            );


            await this.connectSources(
              tx,
              blueprint,
              fixture.id,
              fixtureIds,
            );


            sequence++;
          }


          await tx.auditLog.create({
            data: {
              actorUserId:
                userId,
              action:
                'PLAYOFFS_GENERATED',
              targetType:
                'Tournament',
              targetId:
                tournamentId,
              scopeType:
                'TOURNAMENT',
              scopeId:
                tournamentId,
              afterData: {
                playoffFormat:
                  tournament.playoffFormat,
                playoffSource:
                  source,
                qualifiers:
                  seedOrder,
                fixtures:
                  blueprints.length,
              },
            },
          });


          return {
            fixtures:
              blueprints.length,
            reseedChanged:
              false,
          };
        },
        {
          isolationLevel:
            'Serializable',
        },
      );


    return {
      success:
        true,

      data: {
        message:
          reseed
            ? operation.reseedChanged
              ? 'Existing playoffs updated to the saved playoff format. Safe stale pre-match state was reset where needed.'
              : 'Existing playoffs already match the saved playoff format. No changes were needed.'
            : 'Playoff stage generated successfully.',

        playoffFormat:
          tournament.playoffFormat,

        playoffSource:
          source,

        qualifiersPerGroup:
          qualification.qualifiersPerGroup,

        totalQualifiers:
          seedOrder.length,

        byes:
          rawPlan.byeCount,

        playInMatches:
          rawPlan.playInMatches,

        secondChanceMatches:
          rawPlan.secondChanceMatches,

        bracketSize:
          rawPlan.bracketSize,

        fixtures:
          operation.fixtures,

        eliteSeeds:
          rawPlan.eliteSeeds,

        groups:
          qualification.groups.map(
            (
              group,
            ) => ({
              id:
                group.id,
              name:
                group.name,
              qualifiers:
                group.qualifiers.map(
                  (
                    entry,
                    index,
                  ) => ({
                    position:
                      index +
                      1,
                    registrationId:
                      entry.id,
                    entryName:
                      entry.entryName,
                    points:
                      entry.points,
                    goalDifference:
                      entry.goalDifference,
                    goalsFor:
                      entry.goalsFor,
                  }),
                ),
            }),
          ),
      },

      error:
        null,
    };
  }


  private async reseedExisting(
    tx: any,
    input: {
      userId:
        string;
      tournamentId:
        string;
      blueprints:
        UniversalPlayoffBlueprint[];
      seedOrder:
        string[];
    },
  ) {
    const old: ReseedFixtureRecord[] =
      await tx.fixture.findMany({
        where: {
          tournamentId:
            input.tournamentId,
          phase:
            'PLAYOFF',
        },
        orderBy: {
          sequence:
            'asc',
        },
        include: {
          match: {
            include: {
              _count: {
                select: {
                  resultSubmissions:
                    true,
                  statEvents:
                    true,
                  ocrExtractions:
                    true,
                  disputes:
                    true,
                },
              },
            },
          },
        },
      });


    if (
      old.length !==
      input.blueprints.length
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RESEED_ROUNDS',
          message:
            'Existing playoff fixture count differs from the saved playoff format. Change the format only before playoff fixtures are created.',
        },
      });
    }


    const missingMatch =
      old.find(
        (
          fixture,
        ) =>
          !fixture.match,
      );


    if (
      missingMatch
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RESEED_MATCH_MISSING',
          message:
            `Playoff update blocked: ${missingMatch.fixtureCode} is missing its match record.`,
        },
      });
    }


    const lockedFixture =
      old.find(
        (
          fixture,
        ) =>
          fixture.status !==
          'UNSCHEDULED',
      );


    if (
      lockedFixture
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RESEED_ACTIVITY',
          message:
            `Playoff update blocked: ${lockedFixture.fixtureCode} has fixture status ${lockedFixture.status}.`,
        },
      });
    }


    const realActivity =
      old.find(
        (
          fixture,
        ) => {
          const match =
            fixture.match!;

          return (
            [
              'LIVE',
              'COMPLETED',
              'CANCELLED',
            ].includes(
              match.status,
            ) ||
            Boolean(
              match.confirmedResultSubmissionId,
            ) ||
            Object.values(
              match._count,
            ).some(
              (
                count,
              ) =>
                count >
                0,
            )
          );
        },
      );


    if (
      realActivity
    ) {
      const match =
        realActivity
          .match!;

      const reasons =
        [
          [
            'LIVE',
            'COMPLETED',
            'CANCELLED',
          ].includes(
            match.status,
          )
            ? `match status ${match.status}`
            : null,

          match
            .confirmedResultSubmissionId
            ? 'confirmed result'
            : null,

          match._count
            .resultSubmissions >
          0
            ? `${match._count.resultSubmissions} result submission(s)`
            : null,

          match._count
            .ocrExtractions >
          0
            ? `${match._count.ocrExtractions} OCR upload(s)`
            : null,

          match._count
            .disputes >
          0
            ? `${match._count.disputes} dispute(s)`
            : null,

          match._count
            .statEvents >
          0
            ? `${match._count.statEvents} stat event(s)`
            : null,
        ]
          .filter(
            Boolean,
          )
          .join(
            ', ',
          );


      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RESEED_ACTIVITY',
          message:
            `Playoff update blocked by ${realActivity.fixtureCode}: ${reasons}. Existing results were not modified.`,
        },
      });
    }


    const currentEntrants =
      new Set(
        old.flatMap(
          (
            fixture,
          ) => [
            fixture.homeRegistrationId,
            fixture.awayRegistrationId,
          ],
        ).filter(
          (
            value,
          ): value is string =>
            Boolean(
              value,
            ),
        ),
      );


    if (
      currentEntrants.size !==
        input.seedOrder.length ||
      input.seedOrder.some(
        (
          id,
        ) =>
          !currentEntrants.has(
            id,
          ),
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RESEED_QUALIFIERS',
          message:
            'Qualified entries changed. Existing playoffs were not modified.',
        },
      });
    }


    const fixtureIds =
      new Map<
        string,
        string
      >();


    input.blueprints.forEach(
      (
        blueprint,
        index,
      ) => {
        fixtureIds.set(
          blueprint.key,
          old[
            index
          ]!.id,
        );
      },
    );


    const desired =
      this.desiredProgression(
        input.blueprints,
        fixtureIds,
      );


    const hasStalePrematchState =
      old.some(
        (
          fixture,
        ) =>
          Boolean(
            fixture.scheduledAt,
          ) ||
          fixture.match!
            .status !==
            'UNSCHEDULED' ||
          Boolean(
            fixture.match!
              .homeReadyAt,
          ) ||
          Boolean(
            fixture.match!
              .awayReadyAt,
          ),
      );


    const alreadyMatches =
      !hasStalePrematchState &&
      input.blueprints.every(
        (
          blueprint,
          index,
        ) => {
          const current =
            old[
              index
            ]!;

          const progression =
            desired.get(
              current.id,
            )!;

          return (
            current.phase ===
              'PLAYOFF' &&
            current.homeRegistrationId ===
              blueprint.homeRegistrationId &&
            current.awayRegistrationId ===
              blueprint.awayRegistrationId &&
            current.roundNumber ===
              blueprint.roundNumber &&
            current.roundName ===
              blueprint.roundName &&
            current.bracketPosition ===
              blueprint.bracketPosition &&
            current.nextFixtureId ===
              progression.nextFixtureId &&
            current.nextSlot ===
              progression.nextSlot &&
            current.loserNextFixtureId ===
              progression.loserNextFixtureId &&
            current.loserNextSlot ===
              progression.loserNextSlot
          );
        },
      );


    if (
      alreadyMatches
    ) {
      return {
        fixtures:
          old.length,
        reseedChanged:
          false,
      };
    }


    const before =
      old.map(
        ({
          match:
            _match,
          ...fixture
        }) =>
          fixture,
      );


    for (
      const [
        index,
        blueprint,
      ] of input
        .blueprints
        .entries()
    ) {
      const current =
        old[
          index
        ]!;


      await tx.fixture.update({
        where: {
          id:
            current.id,
        },
        data: {
          phase:
            'PLAYOFF',
          homeRegistrationId:
            blueprint.homeRegistrationId,
          awayRegistrationId:
            blueprint.awayRegistrationId,
          roundNumber:
            blueprint.roundNumber,
          roundName:
            blueprint.roundName,
          bracketPosition:
            blueprint.bracketPosition,
          scheduledAt:
            null,
          status:
            'UNSCHEDULED',
          nextFixtureId:
            null,
          nextSlot:
            null,
          loserNextFixtureId:
            null,
          loserNextSlot:
            null,
        },
      });


      await tx.match.update({
        where: {
          fixtureId:
            current.id,
        },
        data: {
          status:
            'UNSCHEDULED',
          homeReadyAt:
            null,
          awayReadyAt:
            null,
        },
      });
    }


    for (
      const blueprint
      of input.blueprints
    ) {
      await this.connectSources(
        tx,
        blueprint,
        fixtureIds.get(
          blueprint.key,
        )!,
        fixtureIds,
      );
    }


    const after =
      await tx.fixture.findMany({
        where: {
          tournamentId:
            input.tournamentId,
          phase:
            'PLAYOFF',
        },
        orderBy: {
          sequence:
            'asc',
        },
      });


    await tx.auditLog.create({
      data: {
        actorUserId:
          input.userId,
        action:
          'PLAYOFFS_RESEEDED',
        targetType:
          'Tournament',
        targetId:
          input.tournamentId,
        scopeType:
          'TOURNAMENT',
        scopeId:
          input.tournamentId,
        beforeData:
          JSON.parse(
            JSON.stringify(
              before,
            ),
          ),
        afterData:
          JSON.parse(
            JSON.stringify(
              after,
            ),
          ),
      },
    });


    return {
      fixtures:
        old.length,
      reseedChanged:
        true,
    };
  }


  private desiredProgression(
    blueprints:
      UniversalPlayoffBlueprint[],
    fixtureIds:
      Map<
        string,
        string
      >,
  ) {
    const desired =
      new Map<
        string,
        {
          nextFixtureId:
            string |
            null;
          nextSlot:
            'HOME' |
            'AWAY' |
            null;
          loserNextFixtureId:
            string |
            null;
          loserNextSlot:
            'HOME' |
            'AWAY' |
            null;
        }
      >();


    for (
      const fixtureId
      of fixtureIds.values()
    ) {
      desired.set(
        fixtureId,
        {
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
    }


    for (
      const blueprint
      of blueprints
    ) {
      const targetId =
        fixtureIds.get(
          blueprint.key,
        )!;


      this.applyDesiredSource(
        desired,
        fixtureIds,
        blueprint.homeSource,
        targetId,
        'HOME',
      );

      this.applyDesiredSource(
        desired,
        fixtureIds,
        blueprint.awaySource,
        targetId,
        'AWAY',
      );
    }


    return desired;
  }


  private applyDesiredSource(
    desired:
      Map<
        string,
        {
          nextFixtureId:
            string |
            null;
          nextSlot:
            'HOME' |
            'AWAY' |
            null;
          loserNextFixtureId:
            string |
            null;
          loserNextSlot:
            'HOME' |
            'AWAY' |
            null;
        }
      >,
    fixtureIds:
      Map<
        string,
        string
      >,
    source:
      PlayoffSourceRef |
      null,
    targetId:
      string,
    targetSlot:
      'HOME' |
      'AWAY',
  ) {
    if (
      !source
    ) {
      return;
    }


    const sourceId =
      fixtureIds.get(
        source.key,
      );


    if (
      !sourceId
    ) {
      throw new Error(
        `Missing source fixture: ${source.key}`,
      );
    }


    const record =
      desired.get(
        sourceId,
      )!;


    if (
      source.outcome ===
      'WINNER'
    ) {
      record.nextFixtureId =
        targetId;
      record.nextSlot =
        targetSlot;
    } else {
      record.loserNextFixtureId =
        targetId;
      record.loserNextSlot =
        targetSlot;
    }
  }


  private async connectSources(
    tx: any,
    blueprint:
      UniversalPlayoffBlueprint,
    fixtureId:
      string,
    fixtureIds:
      Map<
        string,
        string
      >,
  ) {
    await this.connectSource(
      tx,
      blueprint.homeSource,
      fixtureId,
      'HOME',
      fixtureIds,
    );

    await this.connectSource(
      tx,
      blueprint.awaySource,
      fixtureId,
      'AWAY',
      fixtureIds,
    );
  }


  private async connectSource(
    tx: any,
    source:
      PlayoffSourceRef |
      null,
    targetFixtureId:
      string,
    targetSlot:
      'HOME' |
      'AWAY',
    fixtureIds:
      Map<
        string,
        string
      >,
  ) {
    if (
      !source
    ) {
      return;
    }


    const sourceId =
      fixtureIds.get(
        source.key,
      );


    if (
      !sourceId
    ) {
      throw new Error(
        `Missing source fixture: ${source.key}`,
      );
    }


    await tx.fixture.update({
      where: {
        id:
          sourceId,
      },
      data:
        source.outcome ===
        'WINNER'
          ? {
              nextFixtureId:
                targetFixtureId,
              nextSlot:
                targetSlot,
            }
          : {
              loserNextFixtureId:
                targetFixtureId,
              loserNextSlot:
                targetSlot,
            },
    });
  }


  private buildQualification(
    input: {
      source:
        string;
      tournament:
        any;
      groups:
        Array<{
          id:
            string;
          name:
            string;
          position:
            number;
        }>;
      entries:
        RankedEntry[];
      dto:
        GeneratePlayoffsDto;
    },
  ) {
    if (
      input.source ===
      'GROUP_QUALIFIERS'
    ) {
      if (
        input.groups.length <
        2
      ) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code:
              'GROUPS_REQUIRED',
            message:
              'Group-qualifier playoffs require at least two groups. Use Overall Standings for a single-group Tournament.',
          },
        });
      }


      const qualifiersPerGroup =
        input.tournament
          .qualifiersPerGroup ??
        input.dto
          .qualifiersPerGroup;


      if (
        !Number.isInteger(
          qualifiersPerGroup,
        ) ||
        qualifiersPerGroup <
          1
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'INVALID_QUALIFIER_COUNT',
            message:
              'Choose at least one qualifier from each group.',
          },
        });
      }


      const rankedGroups:
        RankedGroup[] =
        input.groups.map(
          (
            group,
          ) => {
            const groupEntries =
              input.entries
                .filter(
                  (
                    entry,
                  ) =>
                    entry.groupId ===
                    group.id,
                )
                .sort(
                  (
                    left,
                    right,
                  ) =>
                    this.comparePerformance(
                      left,
                      right,
                    ),
                );


            if (
              groupEntries.length <
              qualifiersPerGroup
            ) {
              throw new ConflictException({
                success: false,
                data: null,
                error: {
                  code:
                    'NOT_ENOUGH_GROUP_ENTRIES',
                  message:
                    `${group.name} has ${groupEntries.length} approved entries but ${qualifiersPerGroup} qualifiers are configured.`,
                },
              });
            }


            return {
              id:
                group.id,
              name:
                group.name,
              position:
                group.position,
              qualifiers:
                groupEntries.slice(
                  0,
                  qualifiersPerGroup,
                ),
            };
          },
        );


      return {
        entries:
          rankedGroups.flatMap(
            (
              group,
            ) =>
              group.qualifiers,
          ),
        groups:
          rankedGroups,
        qualifiersPerGroup,
      };
    }


    const qualifierTotal =
      input.tournament
        .playoffQualifiersTotal ??
      input.entries.length;


    if (
      !Number.isInteger(
        qualifierTotal,
      ) ||
      qualifierTotal <
        2 ||
      qualifierTotal >
        input.entries.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'INVALID_PLAYOFF_QUALIFIER_TOTAL',
          message:
            `Playoff qualifier total must be between 2 and ${input.entries.length}.`,
        },
      });
    }


    const ranked =
      this.rankEntries(
        input.entries,
        input.tournament
          .playoffSeedingBasis,
      ).slice(
        0,
        qualifierTotal,
      );


    return {
      entries:
        ranked,
      groups:
        [] as RankedGroup[],
      qualifiersPerGroup:
        null,
    };
  }


  private resolveSeedOrder(
    input: {
      entries:
        RankedEntry[];
      groups:
        RankedGroup[];
      seedingBasis:
        string;
      format:
        string;
      source:
        string;
    },
  ) {
    if (
      input.format ===
        'PROTECTED_SEED' &&
      input.groups.length >
        1 &&
      (
        input.seedingBasis ===
          'AUTO' ||
        input.seedingBasis ===
          'GROUP_POSITION'
      )
    ) {
      return buildPlayoffSeedPlan(
        input.groups.map(
          (
            group,
          ) => ({
            id:
              group.id,
            position:
              group.position,
            qualifiers:
              group.qualifiers.map(
                (
                  entry,
                ) => ({
                  id:
                    entry.id,
                }),
              ),
          }),
        ),
      ).seedOrder;
    }


    if (
      input.groups.length >
        1 &&
      input.seedingBasis ===
        'GROUP_POSITION'
    ) {
      const orderedGroups =
        [
          ...input.groups,
        ].sort(
          (
            left,
            right,
          ) =>
            left.position -
            right.position,
        );

      const maximumRank =
        Math.max(
          ...orderedGroups.map(
            (
              group,
            ) =>
              group.qualifiers.length,
          ),
        );

      const seeded:
        string[] =
        [];

      for (
        let rank =
          0;
        rank <
        maximumRank;
        rank++
      ) {
        for (
          const group
          of orderedGroups
        ) {
          const entry =
            group.qualifiers[
              rank
            ];

          if (
            entry
          ) {
            seeded.push(
              entry.id,
            );
          }
        }
      }

      return seeded;
    }


    const effectiveSeeding =
      input.seedingBasis ===
        'AUTO'
        ? input.source ===
            'DIRECT_ENTRIES'
          ? 'MANUAL'
          : 'OVERALL_PERFORMANCE'
        : input.seedingBasis;


    return this.rankEntries(
      input.entries,
      effectiveSeeding,
    ).map(
      (
        entry,
      ) =>
        entry.id,
    );
  }


  private rankEntries(
    entries:
      RankedEntry[],
    seedingBasis:
      string,
  ) {
    if (
      seedingBasis ===
      'RANDOM'
    ) {
      return this.shuffle(
        entries,
      );
    }


    if (
      seedingBasis ===
      'MANUAL'
    ) {
      return [
        ...entries,
      ].sort(
        (
          left,
          right,
        ) =>
          left.sortOrder -
            right.sortOrder ||
          left.createdAt.getTime() -
            right.createdAt.getTime() ||
          left.id.localeCompare(
            right.id,
          ),
      );
    }


    if (
      seedingBasis ===
        'GROUP_POSITION'
    ) {
      return [
        ...entries,
      ].sort(
        (
          left,
          right,
        ) =>
          (
            left.groupPosition ??
            Number.MAX_SAFE_INTEGER
          ) -
            (
              right.groupPosition ??
              Number.MAX_SAFE_INTEGER
            ) ||
          this.comparePerformance(
            left,
            right,
          ),
      );
    }


    return [
      ...entries,
    ].sort(
      (
        left,
        right,
      ) =>
        this.comparePerformance(
          left,
          right,
        ),
    );
  }


  private comparePerformance(
    left:
      RankedEntry,
    right:
      RankedEntry,
  ) {
    return (
      right.points -
        left.points ||
      right.goalDifference -
        left.goalDifference ||
      right.goalsFor -
        left.goalsFor ||
      right.wins -
        left.wins ||
      left.entryName.localeCompare(
        right.entryName,
      ) ||
      left.id.localeCompare(
        right.id,
      )
    );
  }


  private resolvePlayoffSource(
    configured:
      string,
    competitionFormat:
      string,
    groupMode:
      string,
    groupCount:
      number,
  ) {
    if (
      configured !==
      'AUTO'
    ) {
      return configured;
    }


    if (
      competitionFormat ===
        'SINGLE_ELIMINATION'
    ) {
      return 'DIRECT_ENTRIES';
    }


    if (
      groupMode ===
        'MULTIPLE_GROUPS' &&
      groupCount >
        1
    ) {
      return 'GROUP_QUALIFIERS';
    }


    return 'OVERALL_STANDINGS';
  }


  private async assertStageComplete(
    tournamentId:
      string,
  ) {
    const [
      stageFixtures,
      incomplete,
    ] =
      await Promise.all([
        this.prisma.fixture.count({
          where: {
            tournamentId,
            phase:
              'STAGE',
          },
        }),

        this.prisma.fixture.count({
          where: {
            tournamentId,
            phase:
              'STAGE',
            status: {
              not:
                'COMPLETED',
            },
          },
        }),
      ]);


    if (
      stageFixtures ===
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'STAGE_FIXTURES_REQUIRED',
          message:
            'Generate and complete the Tournament stage before creating playoffs.',
        },
      });
    }


    if (
      incomplete >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'STAGE_NOT_COMPLETED',
          message:
            `${incomplete} stage fixture(s) are still incomplete.`,
        },
      });
    }
  }


  private async loadApprovedEntries(
    client:
      any,
    tournamentId:
      string,
  ): Promise<
    RankedEntry[]
  > {
    const rows =
      await client.tournamentRegistration.findMany({
        where: {
          tournamentId,
          status:
            'APPROVED',
        },
        orderBy: [
          {
            sortOrder:
              'asc',
          },
          {
            createdAt:
              'asc',
          },
        ],
        include: {
          standing:
            true,
          group: {
            select: {
              position:
                true,
            },
          },
        },
      });


    return rows.map(
      (
        registration:
          any,
      ) => ({
        id:
          registration.id,
        entryName:
          registration.entryName ??
          'Tournament Entry',
        groupId:
          registration.groupId,
        groupPosition:
          registration.group
            ?.position ??
          null,
        sortOrder:
          registration.sortOrder,
        createdAt:
          new Date(
            registration.createdAt,
          ),
        points:
          registration.standing
            ?.points ??
          0,
        goalDifference:
          registration.standing
            ?.goalDifference ??
          0,
        goalsFor:
          registration.standing
            ?.goalsFor ??
          0,
        wins:
          registration.standing
            ?.wins ??
          0,
      }),
    );
  }


  private entryFingerprint(
    entries:
      RankedEntry[],
  ) {
    return [
      ...entries,
    ]
      .sort(
        (
          left,
          right,
        ) =>
          left.id.localeCompare(
            right.id,
          ),
      )
      .map(
        (
          entry,
        ) =>
          [
            entry.id,
            entry.groupId ??
              '',
            entry.groupPosition ??
              '',
            entry.sortOrder,
            entry.points,
            entry.goalDifference,
            entry.goalsFor,
            entry.wins,
          ].join(
            ':',
          ),
      )
      .join(
        '|',
      );
  }


  private shuffle<T>(
    values:
      T[],
  ) {
    const shuffled = [
      ...values,
    ];


    for (
      let index =
        shuffled.length -
        1;
      index >
      0;
      index--
    ) {
      const other =
        randomInt(
          0,
          index +
            1,
        );


      [
        shuffled[
          index
        ],
        shuffled[
          other
        ],
      ] = [
        shuffled[
          other
        ]!,
        shuffled[
          index
        ]!,
      ];
    }


    return shuffled;
  }


  private async createMatchForFixture(
    client:
      any,
    tournamentId:
      string,
    fixtureId:
      string,
  ) {
    const match =
      await client.match.create({
        data: {
          tournamentId,
          fixtureId,
        },
      });


    const matchCode =
      `FCA-M-${String(
        match.serialNumber,
      ).padStart(
        6,
        '0',
      )}`;


    return client.match.update({
      where: {
        id:
          match.id,
      },
      data: {
        matchCode,
      },
    });
  }


  private createFixtureCode() {
    return `FCA-F-${randomUUID()
      .replaceAll(
        '-',
        '',
      )
      .slice(
        0,
        10,
      )
      .toUpperCase()}`;
  }


  private tournamentNotFound() {
    return new NotFoundException({
      success: false,
      data: null,
      error: {
        code:
          'TOURNAMENT_NOT_FOUND',
        message:
          'Tournament could not be found.',
      },
    });
  }
}
