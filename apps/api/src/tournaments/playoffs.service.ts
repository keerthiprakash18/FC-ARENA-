import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import { qualificationSnapshot } from './qualification-integrity.js';
import { buildPlayoffSeedPlan } from './playoff-seeding.js';

import type { GeneratePlayoffsDto } from './dto/generate-playoffs.dto.js';

import {
  generateKnockoutFixtures,
} from './fixture-engine.js';

import type {
  FixtureBlueprint,
} from './fixture-engine.js';


interface RankedQualifier {
  id: string;
  entryName: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
  wins: number;
}


@Injectable()
export class PlayoffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
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
          id: tournamentId,
        },

        select: {
          id: true,
          leagueId: true,
          status: true,
        },
      });


    if (!tournament) {
      throw this.tournamentNotFound();
    }


    await this.authorization.assertCanManageTournament(userId, tournamentId);


    const groups =
      await this.prisma.tournamentGroup.findMany({
        where: {
          tournamentId,
        },

        orderBy: {
          position: 'asc',
        },

        include: {
          registrations: {
            where: {
              status: 'APPROVED',
            },

            include: {
              standing: true,
            },
          },
        },
      });


    if (groups.length < 2) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'GROUP_STAGE_REQUIRED',

          message:
            'At least two tournament groups are required before generating playoffs.',
        },
      });
    }


    if (
      groups.length % 2 !==
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'EVEN_GROUP_COUNT_REQUIRED',

          message:
            'Knockout cross-seeding currently requires an even number of groups.',
        },
      });
    }


    const groupFixtureCount =
      await this.prisma.fixture.count({
        where: {
          tournamentId,

          groupId: {
            not: null,
          },
        },
      });


    if (
      groupFixtureCount ===
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'GROUP_FIXTURES_REQUIRED',

          message:
            'Generate and complete the group-stage fixtures first.',
        },
      });
    }


    const incompleteFixtures =
      await this.prisma.fixture.count({
        where: {
          tournamentId,

          groupId: {
            not: null,
          },

          status: {
            not:
              'COMPLETED',
          },
        },
      });


    if (
      incompleteFixtures >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'GROUP_STAGE_NOT_COMPLETED',

          message:
            `${incompleteFixtures} group-stage fixture(s) are still incomplete.`,
        },
      });
    }


    const existingPlayoffs =
      await this.prisma.fixture.count({
        where: {
          tournamentId,
          groupId: null,
        },
      });


    if (
      existingPlayoffs >
      0 && !reseed
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'PLAYOFFS_ALREADY_GENERATED',

          message:
            'Knockout fixtures have already been generated.',
        },
      });
    }


    const qualifiersPerGroup = reseed
      ? (existingPlayoffs + 1) / groups.length
      : dto.qualifiersPerGroup;
    if (!Number.isInteger(qualifiersPerGroup) || qualifiersPerGroup < 1 || (reseed && !existingPlayoffs)) {
      throw new ConflictException({ success: false, data: null, error: { code: 'RESEED_FORMAT', message: 'Existing playoff qualification format cannot be reseeded.' } });
    }


    for (
      const group
      of groups
    ) {
      if (
        group.registrations
          .length <
        qualifiersPerGroup
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'NOT_ENOUGH_GROUP_ENTRIES',

            message:
              `${group.name} contains only ${group.registrations.length} approved entries but ${qualifiersPerGroup} qualifiers were requested.`,
          },
        });
      }
    }


    const totalQualifiers =
      groups.length *
      qualifiersPerGroup;


    const rankedGroups =
      groups.map(
        (group) => {
          const ranked =
            group.registrations
              .map(
                (
                  registration,
                ): RankedQualifier => ({
                  id:
                    registration.id,

                  entryName:
                    registration.entryName ??
                    'Tournament Entry',

                  points:
                    registration
                      .standing
                      ?.points ??
                    0,

                  goalDifference:
                    registration
                      .standing
                      ?.goalDifference ??
                    0,

                  goalsFor:
                    registration
                      .standing
                      ?.goalsFor ??
                    0,

                  wins:
                    registration
                      .standing
                      ?.wins ??
                    0,
                }),
              )
              .sort(
                (
                  a,
                  b,
                ) => {
                  if (
                    b.points !==
                    a.points
                  ) {
                    return (
                      b.points -
                      a.points
                    );
                  }

                  if (
                    b.goalDifference !==
                    a.goalDifference
                  ) {
                    return (
                      b.goalDifference -
                      a.goalDifference
                    );
                  }

                  if (
                    b.goalsFor !==
                    a.goalsFor
                  ) {
                    return (
                      b.goalsFor -
                      a.goalsFor
                    );
                  }

                  if (
                    b.wins !==
                    a.wins
                  ) {
                    return (
                      b.wins -
                      a.wins
                    );
                  }

                  return a.entryName.localeCompare(
                    b.entryName,
                  );
                },
              )
              .slice(
                0,
                qualifiersPerGroup,
              );


          return {
            id:
              group.id,

            name:
              group.name,

            position:
              group.position,

            qualifiers:
              ranked,
          };
        },
      );


    const seedPlan = buildPlayoffSeedPlan(rankedGroups);
    const seedOrder = seedPlan.seedOrder;


    if (
      seedOrder.length !==
      totalQualifiers
    ) {
      throw new Error(
        'Invalid playoff seed generation.',
      );
    }


    const uniqueSeeds =
      new Set(
        seedOrder,
      );


    if (
      uniqueSeeds.size !==
      seedOrder.length
    ) {
      throw new Error(
        'Duplicate playoff qualifier detected.',
      );
    }


    const blueprints =
      generateKnockoutFixtures(
        seedOrder,
        seedPlan.bracketSlots,
      ).map((blueprint) => seedPlan.byeCount > 0 && blueprint.roundNumber === 1
        ? { ...blueprint, roundName: 'PLAY-IN' }
        : blueprint);


    const operation =
      await this.prisma.$transactionWithRetry(
        async (tx) => {
          const currentGroups = await tx.tournamentGroup.findMany({
            where: { tournamentId },
            include: { registrations: { where: { status: 'APPROVED' }, include: { standing: true } } },
          });
          const incomplete = await tx.fixture.count({
            where: { tournamentId, groupId: { not: null }, status: { not: 'COMPLETED' } },
          });
          if (incomplete || qualificationSnapshot(groups) !== qualificationSnapshot(currentGroups)) {
            throw new ConflictException({ success: false, data: null, error: {
              code: 'QUALIFICATION_CHANGED', message: 'Group results or entries changed. Recheck standings before generating playoffs.',
            } });
          }
          if (reseed) {
            const old = await tx.fixture.findMany({
              where: { tournamentId, groupId: null },
              orderBy: [{ roundNumber: 'asc' }, { bracketPosition: 'asc' }, { sequence: 'asc' }],
              include: { match: { include: { _count: { select: {
                resultSubmissions: true, statEvents: true, ocrExtractions: true, disputes: true,
              } } } } },
            });
            if (old.length !== blueprints.length) {
              throw new ConflictException({ success: false, data: null, error: {
                code: 'RESEED_ROUNDS',
                message: 'Existing playoff fixture count differs from the protected bracket structure.',
              } });
            }
            if (old.some((f) =>
              f.status !== 'UNSCHEDULED' || f.scheduledAt || !f.match ||
              f.match.status !== 'UNSCHEDULED' || f.match.confirmedResultSubmissionId ||
              f.match.homeReadyAt || f.match.awayReadyAt ||
              Object.values(f.match._count).some((count) => count > 0)
            )) {
              throw new ConflictException({ success: false, data: null, error: { code: 'RESEED_ACTIVITY', message: 'Playoff reseeding blocked: a match is scheduled, started, ready, or has match activity (result, OCR upload, dispute or stat event).' } });
            }
            const currentEntrants = new Set(old.flatMap((f) => [f.homeRegistrationId, f.awayRegistrationId]).filter(Boolean));
            if (currentEntrants.size !== seedOrder.length || seedOrder.some((id) => !currentEntrants.has(id))) {
              throw new ConflictException({ success: false, data: null, error: { code: 'RESEED_QUALIFIERS', message: 'Qualified teams changed. Existing playoffs were not modified.' } });
            }

            const ids = new Map<string, string>();
            blueprints.forEach((b, i) => {
              if (old[i].roundNumber !== b.roundNumber) {
                throw new ConflictException({ success: false, data: null, error: { code: 'RESEED_ROUNDS', message: 'Existing playoff round structure differs.' } });
              }
              ids.set(b.key, old[i].id);
            });

            const desiredProgression = new Map<string, { nextFixtureId: string | null; nextSlot: 'HOME' | 'AWAY' | null }>(
              old.map((fixture) => [fixture.id, { nextFixtureId: null, nextSlot: null }]),
            );
            for (const blueprint of blueprints) {
              const targetId = ids.get(blueprint.key)!;
              if (blueprint.homeSourceKey) {
                const sourceId = ids.get(blueprint.homeSourceKey);
                if (!sourceId) throw new Error(`Missing source fixture: ${blueprint.homeSourceKey}`);
                desiredProgression.set(sourceId, { nextFixtureId: targetId, nextSlot: 'HOME' });
              }
              if (blueprint.awaySourceKey) {
                const sourceId = ids.get(blueprint.awaySourceKey);
                if (!sourceId) throw new Error(`Missing source fixture: ${blueprint.awaySourceKey}`);
                desiredProgression.set(sourceId, { nextFixtureId: targetId, nextSlot: 'AWAY' });
              }
            }

            const alreadyProtected = blueprints.every((blueprint, index) => {
              const current = old[index];
              const progression = desiredProgression.get(current.id)!;
              return current.homeRegistrationId === blueprint.homeRegistrationId &&
                current.awayRegistrationId === blueprint.awayRegistrationId &&
                current.roundName === blueprint.roundName &&
                current.bracketPosition === blueprint.bracketPosition &&
                current.nextFixtureId === progression.nextFixtureId &&
                current.nextSlot === progression.nextSlot;
            });

            if (alreadyProtected) {
              return { fixtures: old.length, reseedChanged: false };
            }

            const before = old.map(({ match: _match, ...fixture }) => fixture);
            for (const [i, b] of blueprints.entries()) {
              await tx.fixture.update({ where: { id: old[i].id }, data: {
                homeRegistrationId: b.homeRegistrationId, awayRegistrationId: b.awayRegistrationId,
                roundName: b.roundName, bracketPosition: b.bracketPosition,
                nextFixtureId: null, nextSlot: null,
              } });
            }
            for (const b of blueprints) {
              await this.connectPreviousFixtures(tx, b, ids.get(b.key)!, ids);
            }
            const after = await tx.fixture.findMany({ where: { tournamentId, groupId: null }, orderBy: { sequence: 'asc' } });
            await tx.auditLog.create({ data: {
              actorUserId: userId, action: 'PLAYOFFS_RESEEDED', targetType: 'Tournament', targetId: tournamentId,
              beforeData: JSON.parse(JSON.stringify(before)), afterData: JSON.parse(JSON.stringify(after)),
            } });
            return { fixtures: old.length, reseedChanged: true };
          }
          const existing =
            await tx.fixture.count({
              where: {
                tournamentId,
                groupId: null,
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
                  'Knockout fixtures have already been generated.',
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
                sequence: true,
              },
            });


          let sequence =
            (latestFixture
              ?.sequence ??
              0) + 1;


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


            await this.connectPreviousFixtures(
              tx,
              blueprint,
              fixture.id,
              fixtureIds,
            );


            sequence++;
          }


          return {
            fixtures:
              sequence -
              ((latestFixture
                ?.sequence ??
                0) + 1),
            reseedChanged: false,
          };
        },

        {
          isolationLevel:
            'Serializable',
        },
      );


    return {
      success: true,

      data: {
        message:
          reseed
            ? operation.reseedChanged
              ? 'Existing playoffs reseeded successfully.'
              : 'Existing playoffs already use protected seeding. No changes were needed.'
            : 'Knockout stage generated successfully.',

        qualifiersPerGroup,

        totalQualifiers,

        byes:
          seedPlan.byeCount,

        playInMatches:
          seedPlan.playInMatches,

        bracketSize:
          seedPlan.bracketSize,

        fixtures:
          operation.fixtures,

        groups:
          rankedGroups.map(
            (group) => ({
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
                      index + 1,

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

      error: null,
    };
  }


  private async createMatchForFixture(
    client: any,
    tournamentId: string,
    fixtureId: string,
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


  private async connectPreviousFixtures(
    tx: any,
    blueprint:
      FixtureBlueprint,
    fixtureId: string,
    fixtureIds:
      Map<string, string>,
  ) {
    if (
      blueprint.homeSourceKey
    ) {
      const sourceId =
        fixtureIds.get(
          blueprint.homeSourceKey,
        );


      if (!sourceId) {
        throw new Error(
          `Missing source fixture: ${blueprint.homeSourceKey}`,
        );
      }


      await tx.fixture.update({
        where: {
          id:
            sourceId,
        },

        data: {
          nextFixtureId:
            fixtureId,

          nextSlot:
            'HOME',
        },
      });
    }


    if (
      blueprint.awaySourceKey
    ) {
      const sourceId =
        fixtureIds.get(
          blueprint.awaySourceKey,
        );


      if (!sourceId) {
        throw new Error(
          `Missing source fixture: ${blueprint.awaySourceKey}`,
        );
      }


      await tx.fixture.update({
        where: {
          id:
            sourceId,
        },

        data: {
          nextFixtureId:
            fixtureId,

          nextSlot:
            'AWAY',
        },
      });
    }
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