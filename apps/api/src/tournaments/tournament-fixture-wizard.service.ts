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
import { AuthorizationService } from '../security/authorization.service.js';

import type {
  GenerateFixturePreviewDto,
} from './dto/generate-fixture-preview.dto.js';

import type {
  UpdateFixtureWizardSettingsDto,
} from './dto/update-fixture-wizard-settings.dto.js';

import {
  generateDoubleRoundRobinFixtures,
  generateKnockoutFixtures,
  generateRoundRobinFixtures,
  type FixtureBlueprint,
} from './fixture-engine.js';

import {
  buildUniversalPlayoffPlan,
  type PlayoffSourceRef,
} from './universal-playoff-engine.js';
import { generateEliteCupSchedule } from './elite-cup-engine.js';
import { generateUclLeaguePhase } from './ucl-engine.js';
import type { Prisma } from '../generated/prisma/client.js';
import { assertBalancedGroupInputs, groupInputsFingerprint, readGroupInputs, type GroupInputs } from './group-balance.js';


@Injectable()
export class TournamentFixtureWizardService {
  constructor(
    private readonly prisma:
      PrismaService,
    private readonly authorization:
      AuthorizationService,
  ) {}


  async getSettings(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    return {
      success: true,

      data: {
        fixtureMode:
          tournament.fixtureMode,

        legType:
          tournament.legType,

        competitionFormat:
          tournament.competitionFormat,

        groupMode:
          tournament.groupMode,

        dailyMatchLimit:
          tournament.dailyMatchLimit,

        matchesPerParticipantPerDay:
          tournament.matchesPerParticipantPerDay,

        matchDurationMinutes:
          tournament.matchDurationMinutes,
      },

      error: null,
    };
  }


  async updateSettings(
    userId: string,
    tournamentId: string,
    dto: UpdateFixtureWizardSettingsDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    const updated =
      await this.prisma.tournament.update({
        where: {
          id:
            tournamentId,
        },

        data: {
          fixtureMode:
            ['ELITE_CUP', 'UCL_CUP'].includes(tournament.competitionFormat)
              ? dto.fixtureMode === 'RANDOMIZED'
                ? 'RANDOMIZED'
                : 'AUTOMATIC'
              : dto.fixtureMode,

          legType:
            ['ELITE_CUP', 'UCL_CUP'].includes(tournament.competitionFormat)
              ? 'SINGLE_LEG'
              : dto.legType,

          dailyMatchLimit:
            dto.dailyMatchLimit,

          matchesPerParticipantPerDay:
            dto.matchesPerParticipantPerDay,

          matchDurationMinutes:
            dto.matchDurationMinutes,

          wizardStep:
            'FIXTURE_PREVIEW',
        },
      });

    return {
      success: true,

      data: {
        message:
          'Fixture settings saved.',

        tournament:
          updated,

        nextStep:
          'FIXTURE_PREVIEW',
      },

      error: null,
    };
  }


  async generatePreview(
    userId: string,
    tournamentId: string,
    dto:
      GenerateFixturePreviewDto = {},
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    if (
      dto.groupId &&
      tournament.groupMode !==
        'MULTIPLE_GROUPS'
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'GROUP_SCOPE_NOT_AVAILABLE',

          message:
            'Specific Group generation is only available for Multiple Group tournaments.',
        },
      });
    }

    if (
      dto.groupId
    ) {
      await this.assertGroupBelongsToTournament(
        tournamentId,
        dto.groupId,
      );
    }

    const published =
      await this.prisma.fixture.count({
        where: {
          tournamentId,

          ...(dto.groupId
            ? {
                groupId:
                  dto.groupId,
              }
            : {}),

          publishedAt: {
            not: null,
          },
        },
      });

    if (
      published >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'PUBLISHED_FIXTURES_LOCKED',

          message:
            dto.groupId
              ? 'This Group already contains published fixtures. Existing official fixtures cannot be regenerated.'
              : 'Published fixtures cannot be regenerated from the Tournament wizard.',
        },
      });
    }

    if (
      tournament.fixtureMode ===
      'MANUAL'
    ) {
      return {
        success: true,

        data: {
          message:
            'Manual fixture mode selected. Add matches from Fixture Preview.',

          fixtures:
            0,
        },

        error: null,
      };
    }

    const inputs = await readGroupInputs(this.prisma, tournamentId);
    const selectedIds = dto.registrationIds ? [...dto.registrationIds] : null;
    if (selectedIds) {
      const chosen = inputs.entries.filter(entry => selectedIds.includes(entry.id));
      if (chosen.length !== selectedIds.length) throw new BadRequestException({ success: false, data: null, error: { code: 'INVALID_FIXTURE_PARTICIPANTS', message: 'Every selected participant must be an approved entry in this Tournament.' } });
      if (dto.groupId && chosen.some(entry => entry.groupId !== dto.groupId)) throw new BadRequestException({ success: false, data: null, error: { code: 'CROSS_GROUP_SELECTION', message: 'Every selected participant must belong to the selected Group.' } });
    }
    if (tournament.groupMode === 'MULTIPLE_GROUPS' && !dto.groupId && !selectedIds && tournament.competitionFormat !== 'SINGLE_ELIMINATION') assertBalancedGroupInputs(inputs);

    if (
      tournament.competitionFormat ===
      'SINGLE_ELIMINATION'
    ) {
      return this.generateDirectPlayoffPreview(
        tournament,
        tournamentId,
        dto,
        selectedIds,
        inputs,
      );
    }

    const plans:
      Array<{
        groupId:
          string | null;

        groupName:
          string | null;

        registrationIds:
          string[];

        blueprints:
          FixtureBlueprint[];
      }> = [];


    if (
      dto.groupId
    ) {
      const group = inputs.groups.find(group => group.id === dto.groupId);
      if (!group) throw new ConflictException({ success: false, data: null, error: { code: 'FIXTURE_INPUTS_CHANGED', message: 'This group changed. Reload Groups and generate the preview again.' } });
      const ids = selectedIds ?? inputs.entries.filter(entry => entry.groupId === group.id).map(entry => entry.id);

      this.assertEnoughParticipants(
        ids,
        group.name,
      );

      plans.push({
        groupId:
          group.id,

        groupName:
          group.name,

        registrationIds:
          this.maybeShuffle(
            ids,
            tournament.fixtureMode,
          ),

        blueprints:
          [],
      });
    } else if (
      tournament.groupMode ===
      'MULTIPLE_GROUPS'
    ) {
      const groups = inputs.groups.map(group => ({ ...group, registrations: inputs.entries.filter(entry => entry.groupId === group.id && (!selectedIds || selectedIds.includes(entry.id))).map(entry => ({ id: entry.id })) }));

      if (
        groups.length <
        2
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'GROUPS_NOT_READY',

            message:
              'Configure Tournament groups before generating fixtures.',
          },
        });
      }

      if (
        selectedIds
      ) {
        const assigned =
          new Set(
            groups.flatMap(
              (
                group,
              ) =>
                group.registrations.map(
                  (
                    registration,
                  ) =>
                    registration.id,
                ),
            ),
          );

        const unassignedSelection =
          selectedIds.filter(
            (
              id,
            ) =>
              !assigned.has(
                id,
              ),
          );

        if (
          unassignedSelection.length >
          0
        ) {
          throw new BadRequestException({
            success: false,
            data: null,

            error: {
              code:
                'SELECTED_PARTICIPANTS_NOT_GROUPED',

              message:
                'Every selected participant must be assigned to a Tournament Group before Whole Tournament group-stage generation.',
            },
          });
        }
      }

      for (
        const group
        of groups
      ) {
        const ids =
          group.registrations.map(
            (
              registration,
            ) =>
              registration.id,
          );

        if (
          selectedIds &&
          ids.length ===
          0
        ) {
          continue;
        }

        this.assertEnoughParticipants(
          ids,
          group.name,
        );

        plans.push({
          groupId:
            group.id,

          groupName:
            group.name,

          registrationIds:
            this.maybeShuffle(
              ids,
              tournament.fixtureMode,
            ),

          blueprints:
            [],
        });
      }
    } else {
      const ids = selectedIds ?? inputs.entries.map(entry => entry.id);

      this.assertEnoughParticipants(
        ids,
        'Tournament',
      );

      plans.push({
        groupId:
          null,

        groupName:
          null,

        registrationIds:
          this.maybeShuffle(
            ids,
            tournament.fixtureMode,
          ),

        blueprints:
          [],
      });
    }


    if (
      plans.length ===
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'NO_FIXTURE_SCOPE',

          message:
            'No valid participants are available for this fixture scope.',
        },
      });
    }

    const matchdayPrefix =
      dto.matchdayPrefix
        ?.trim() ||
      'Matchday';

    for (
      const plan
      of plans
    ) {
      const generated =
        this.generateBlueprints(
          tournament.competitionFormat,
          tournament.legType,
          plan.registrationIds,
        );

      plan.blueprints =
        this.applyHomeAwayMode(
          generated,
          dto.homeAwayMode ??
            'BALANCED',
        );
    }


    await this.prisma.$transactionWithRetry(
      async (tx) => {
        let sequence = await this.preparePreviewReplacement(tx, tournament, tournamentId, dto, inputs);
        for (
          const plan
          of plans
        ) {
          for (
            const blueprint
            of plan.blueprints
          ) {
            sequence++;

            const scheduledAt =
              this.buildScheduledAt(
                dto,
                blueprint.roundNumber,
              );

            await tx.fixture.create({
              data: {
                fixtureCode:
                  this.fixtureCode(),

                tournamentId,

                groupId:
                  plan.groupId,

                sequence,

                matchday:
                  blueprint.matchday,

                roundNumber:
                  blueprint.roundNumber,

                roundName:
                  plan.groupName
                    ? `${plan.groupName} - ${matchdayPrefix} ${blueprint.roundNumber}`
                    : `${matchdayPrefix} ${blueprint.roundNumber}`,

                bracketPosition:
                  blueprint.bracketPosition,

                phase:
                  'STAGE',

                homeRegistrationId:
                  blueprint.homeRegistrationId,

                awayRegistrationId:
                  blueprint.awayRegistrationId,

                scheduledAt,

                publishedAt:
                  null,
              },
            });
          }
        }
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
          'Fixture preview generated successfully.',

        fixtures:
          plans.reduce(
            (
              total,
              plan,
            ) =>
              total +
              plan.blueprints.length,
            0,
          ),

        groups:
          plans.map(
            (
              plan,
            ) => ({
              groupId:
                plan.groupId,

              groupName:
                plan.groupName,

              participants:
                plan.registrationIds.length,

              fixtures:
                plan.blueprints.length,
            }),
          ),
      },

      error: null,
    };
  }


  async getPreview(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    const fixtures =
      await this.prisma.fixture.findMany({
        where: {
          tournamentId,

          publishedAt:
            null,
        },

        orderBy: [
          {
            roundNumber:
              'asc',
          },
          {
            bracketPosition:
              'asc',
          },
        ],

        include: {
          group: {
            select: {
              id: true,
              name: true,
              position: true,
            },
          },

          homeRegistration: {
            select: {
              id: true,
              entryName: true,
              entryLogoUrl: true,
            },
          },

          awayRegistration: {
            select: {
              id: true,
              entryName: true,
              entryLogoUrl: true,
            },
          },
        },
      });

    return {
      success: true,

      data: {
        tournament: {
          id:
            tournament.id,

          name:
            tournament.name,

          competitionFormat:
            tournament.competitionFormat,

          fixtureMode:
            tournament.fixtureMode,

          legType:
            tournament.legType,

          groupMode:
            tournament.groupMode,
        },

        fixtures,
      },

      error: null,
    };
  }


  async resetPreview(
    userId: string,
    tournamentId: string,
    groupId?: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    this.assertDraft(
      tournament.status,
    );

    if (
      groupId
    ) {
      await this.assertGroupBelongsToTournament(
        tournamentId,
        groupId,
      );
    }

    const deleted = await this.prisma.$transactionWithRetry(async tx => {
      const current = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
      this.assertDraft(current.status);
      await new AuthorizationService(tx as unknown as PrismaService).assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_SETTINGS');
      if (groupId) {
        const group = await tx.tournamentGroup.findUnique({ where: { id: groupId }, select: { tournamentId: true } });
        if (!group || group.tournamentId !== tournamentId) throw new NotFoundException({ success: false, data: null, error: { code: 'TOURNAMENT_GROUP_NOT_FOUND', message: 'Tournament Group could not be found. Reload the groups before resetting this preview.' } });
      }
      const scope = { tournamentId, ...(groupId ? { groupId } : {}) };
      await this.assertPreviewResettable(tx, scope);
      return tx.fixture.deleteMany({ where: { ...scope, publishedAt: null } });
    }, { isolationLevel: 'Serializable' });

    return {
      success: true,

      data: {
        message:
          groupId
            ? 'Group fixture preview reset.'
            : 'Fixture preview reset.',

        deleted:
          deleted.count,
      },

      error: null,
    };
  }


  private async generateDirectPlayoffPreview(
    tournament: any,
    tournamentId: string,
    dto: GenerateFixturePreviewDto,
    selectedIds: string[] | null,
    inputs: GroupInputs,
  ) {
    let registrationIds = selectedIds ?? inputs.entries.map(entry => entry.id);

    const configuredTotal =
      tournament.playoffQualifiersTotal ??
      registrationIds.length;

    if (
      !selectedIds &&
      configuredTotal <
        registrationIds.length
    ) {
      registrationIds =
        registrationIds.slice(
          0,
          configuredTotal,
        );
    }

    this.assertEnoughParticipants(
      registrationIds,
      'Tournament',
    );

    if (
      tournament.playoffFormat ===
        'DOUBLE_CHANCE' &&
      registrationIds.length <
        3
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'DOUBLE_CHANCE_REQUIRES_THREE',
          message:
            'Elite Double-Chance requires at least three entries.',
        },
      });
    }

    const randomize =
      tournament.playoffSeedingBasis ===
        'RANDOM' ||
      tournament.fixtureMode ===
        'RANDOMIZED';

    const seedOrder =
      randomize
        ? this.maybeShuffle(
            registrationIds,
            'RANDOMIZED',
          )
        : registrationIds;

    const plan =
      buildUniversalPlayoffPlan(
        tournament.playoffFormat,
        seedOrder,
      );

    const blueprints =
      plan.fixtures.map(
        (
          blueprint,
        ) => ({
          ...blueprint,
          roundName:
            plan.byeCount >
              0 &&
            blueprint.roundNumber ===
              1 &&
            tournament.playoffFormat !==
              'DOUBLE_CHANCE'
              ? 'PLAY-IN'
              : blueprint.roundName,
        }),
      );

    await this.prisma.$transactionWithRetry(
      async (tx) => {
        let sequence = await this.preparePreviewReplacement(tx, tournament, tournamentId, dto, inputs);
        const ids =
          new Map<
            string,
            string
          >();

        for (
          const blueprint
          of blueprints
        ) {
          sequence++;

          const fixture =
            await tx.fixture.create({
              data: {
                fixtureCode:
                  this.fixtureCode(),
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
                scheduledAt:
                  this.buildScheduledAt(
                    dto,
                    blueprint.roundNumber,
                  ),
                publishedAt:
                  null,
              },
            });

          ids.set(
            blueprint.key,
            fixture.id,
          );

          await this.connectUniversalSource(
            tx,
            blueprint.homeSource,
            fixture.id,
            'HOME',
            ids,
          );

          await this.connectUniversalSource(
            tx,
            blueprint.awaySource,
            fixture.id,
            'AWAY',
            ids,
          );
        }
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
          'Playoff fixture preview generated successfully.',
        fixtures:
          blueprints.length,
        playoffFormat:
          tournament.playoffFormat,
        byes:
          plan.byeCount,
        secondChanceMatches:
          plan.secondChanceMatches,
        groups: [
          {
            groupId:
              null,
            groupName:
              null,
            participants:
              seedOrder.length,
            fixtures:
              blueprints.length,
          },
        ],
      },
      error: null,
    };
  }


  private async preparePreviewReplacement(tx: Prisma.TransactionClient, tournament: any, tournamentId: string, dto: GenerateFixturePreviewDto, inputs: GroupInputs): Promise<number> {
    const current = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
    const fields = ['status', 'fixtureMode', 'competitionFormat', 'legType', 'groupMode', 'playoffFormat', 'playoffSeedingBasis', 'playoffQualifiersTotal'] as const;
    const freshInputs = await readGroupInputs(tx, tournamentId);
    if (fields.some(key => current[key] !== tournament[key]) || groupInputsFingerprint(freshInputs) !== groupInputsFingerprint(inputs)) throw new ConflictException({ success: false, data: null, error: { code: 'FIXTURE_INPUTS_CHANGED', message: 'Approved teams, groups or fixture settings changed. Reload Groups and generate the preview again.' } });
    const scope = { tournamentId, ...(dto.groupId ? { groupId: dto.groupId } : {}) };
    if (await tx.fixture.count({ where: { ...scope, publishedAt: { not: null } } })) throw new ConflictException({ success: false, data: null, error: { code: 'PUBLISHED_FIXTURES_LOCKED', message: 'Official fixtures were published while preparing this preview. Reload the tournament before editing fixtures.' } });
    await this.assertPreviewResettable(tx, scope);
    await tx.fixture.deleteMany({ where: { ...scope, publishedAt: null } });
    return (await tx.fixture.findFirst({ where: { tournamentId }, orderBy: { sequence: 'desc' }, select: { sequence: true } }))?.sequence ?? 0;
  }

  /** Internal unpublished bracket links are fresh wiring, not played history. */
  private async assertPreviewResettable(tx: Prisma.TransactionClient, scope: { tournamentId: string; groupId?: string }): Promise<void> {
    const fixtures = await tx.fixture.findMany({ where: { ...scope, publishedAt: null }, orderBy: { sequence: 'asc' }, include: {
      deadlineCase: { select: { id: true } },
      previousFixtures: { select: { id: true } }, previousLoserFixtures: { select: { id: true } },
      match: { include: { arenaPost: { select: { id: true } }, _count: { select: { resultSubmissions: true, statEvents: true, ocrExtractions: true, disputes: true } } } },
    } });
    const ids = new Set(fixtures.map(fixture => fixture.id));
    const safeStatuses = new Set(['UNSCHEDULED', 'SCHEDULED', 'POSTPONED']);
    for (const fixture of fixtures) {
      const match = fixture.match;
      const externalProgression = (fixture.nextFixtureId && !ids.has(fixture.nextFixtureId)) || (fixture.loserNextFixtureId && !ids.has(fixture.loserNextFixtureId)) || fixture.previousFixtures.some(previous => !ids.has(previous.id)) || fixture.previousLoserFixtures.some(previous => !ids.has(previous.id));
      const incompleteProgression = Boolean(fixture.nextFixtureId) !== Boolean(fixture.nextSlot) || Boolean(fixture.loserNextFixtureId) !== Boolean(fixture.loserNextSlot);
      const activity = match && (!safeStatuses.has(match.status) || match.homeReadyAt || match.awayReadyAt || match.confirmedResultSubmissionId || match.arenaPost || Object.values(match._count).some(count => count > 0));
      if (!safeStatuses.has(fixture.status) || fixture.deadlineCase || externalProgression || incompleteProgression || activity) throw new ConflictException({ success: false, data: null, error: {
        code: 'FIXTURE_PREVIEW_HAS_MATCH_ACTIVITY', fixtureCode: fixture.fixtureCode,
        message: `${fixture.fixtureCode}: this preview contains match activity, recorded history or progression outside the reset scope. Existing fixtures, results and proof have been preserved.`,
      } });
    }
  }

  private async connectUniversalSource(
    tx: any,
    source: PlayoffSourceRef | null,
    targetFixtureId: string,
    targetSlot: 'HOME' | 'AWAY',
    fixtureIds: Map<string, string>,
  ) {
    if (!source) {
      return;
    }

    const sourceFixtureId =
      fixtureIds.get(
        source.key,
      );

    if (!sourceFixtureId) {
      throw new Error(
        `Missing playoff source fixture: ${source.key}`,
      );
    }

    await tx.fixture.update({
      where: {
        id:
          sourceFixtureId,
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


  private generateBlueprints(
    competitionFormat:
      string,

    legType:
      string,

    registrationIds:
      string[],
  ) {
    if (competitionFormat === 'ELITE_CUP' || competitionFormat === 'UCL_CUP') {
      const schedule = competitionFormat === 'UCL_CUP' ? generateUclLeaguePhase(registrationIds) : generateEliteCupSchedule(
        registrationIds,
        Math.min(8, Math.max(1, registrationIds.length - 1)),
      );

      return schedule.fixtures.map((fixture) => ({
        key: fixture.key,
        roundNumber: fixture.roundNumber,
        roundName: fixture.roundName,
        matchday: fixture.matchday,
        bracketPosition: fixture.bracketPosition,
        homeRegistrationId: fixture.homeRegistrationId,
        awayRegistrationId: fixture.awayRegistrationId,
        homeSourceKey: null,
        awaySourceKey: null,
      }));
    }

    if (
      competitionFormat ===
      'SINGLE_ELIMINATION'
    ) {
      return generateKnockoutFixtures(
        registrationIds,
      );
    }

    if (
      competitionFormat ===
        'DOUBLE_ROUND_ROBIN' ||
      legType ===
        'HOME_AWAY'
    ) {
      return generateDoubleRoundRobinFixtures(
        registrationIds,
      );
    }

    return generateRoundRobinFixtures(
      registrationIds,
    );
  }


  private applyHomeAwayMode(
    source: FixtureBlueprint[],
    mode: 'BALANCED' | 'RANDOM' | 'MANUAL',
  ) {
    const fixtures = source.map(fixture => ({ ...fixture }));
    // Reversing the complete draw preserves each team's balance, return legs,
    // and UCL pot allocations. Independent coin flips can undo that fairness.
    if (mode === 'RANDOM' && randomInt(0, 2) === 1) {
      for (const fixture of fixtures) {
        [fixture.homeRegistrationId, fixture.awayRegistrationId] =
          [fixture.awayRegistrationId, fixture.homeRegistrationId];
        [fixture.homeSourceKey, fixture.awaySourceKey] =
          [fixture.awaySourceKey, fixture.homeSourceKey];
      }
    }
    return fixtures;
  }


  private maybeShuffle(
    ids:
      string[],

    fixtureMode:
      string,
  ) {
    if (
      fixtureMode !==
      'RANDOMIZED'
    ) {
      return [
        ...ids,
      ];
    }

    return this.shuffle(
      ids,
    );
  }


  private async validateSelectedRegistrations(
    tournamentId:
      string,

    registrationIds:
      string[],

    groupId?:
      string,
  ) {
    const registrations =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,

          id: {
            in:
              registrationIds,
          },

          status:
            'APPROVED',
        },

        select: {
          id: true,
          groupId: true,
        },
      });

    if (
      registrations.length !==
      registrationIds.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_FIXTURE_PARTICIPANTS',

          message:
            'Every selected participant must be an approved entry in this Tournament.',
        },
      });
    }

    if (
      groupId &&
      registrations.some(
        (
          registration,
        ) =>
          registration.groupId !==
          groupId,
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'CROSS_GROUP_SELECTION',

          message:
            'Every selected participant must belong to the selected Group.',
        },
      });
    }

    return [
      ...registrationIds,
    ];
  }


  private async getApprovedRegistrationIds(
    tournamentId:
      string,

    groupId?:
      string,
  ) {
    return (
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,

          status:
            'APPROVED',

          ...(groupId
            ? {
                groupId,
              }
            : {}),
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

        select: {
          id: true,
        },
      })
    ).map(
      (
        registration,
      ) =>
        registration.id,
    );
  }


  private assertEnoughParticipants(
    ids:
      string[],

    scopeName:
      string,
  ) {
    if (
      ids.length <
      2
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'NOT_ENOUGH_TEAMS',

          message:
            `${scopeName} requires at least two participants.`,
        },
      });
    }
  }


  private buildScheduledAt(
    dto:
      GenerateFixturePreviewDto,

    roundNumber:
      number,
  ) {
    if (
      !dto.startDate
    ) {
      return null;
    }

    const value =
      new Date(
        dto.startDate,
      );

    const interval =
      dto.matchdayIntervalDays ??
      0;

    value.setUTCDate(
      value.getUTCDate() +
      (
        roundNumber -
        1
      ) *
      interval,
    );

    if (
      dto.defaultMatchTime
    ) {
      const [
        hour,
        minute,
      ] =
        dto.defaultMatchTime
          .split(':')
          .map(
            Number,
          );

      value.setUTCHours(
        hour,
        minute,
        0,
        0,
      );
    }

    return value;
  }


  private async assertGroupBelongsToTournament(
    tournamentId:
      string,

    groupId:
      string,
  ) {
    const group =
      await this.prisma.tournamentGroup.findUnique({
        where: {
          id:
            groupId,
        },

        select: {
          tournamentId: true,
        },
      });

    if (
      !group ||
      group.tournamentId !==
      tournamentId
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_FIXTURE_GROUP',

          message:
            'Selected Group does not belong to this Tournament.',
        },
      });
    }
  }


  private shuffle(
    source:
      string[],
  ) {
    const values = [
      ...source,
    ];

    for (
      let index =
        values.length -
        1;
      index >
      0;
      index--
    ) {
      const swap =
        randomInt(
          0,
          index +
            1,
        );

      [
        values[index],
        values[swap],
      ] = [
        values[swap],
        values[index],
      ];
    }

    return values;
  }


  private fixtureCode() {
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


  private async getTournamentForAdmin(
    userId:
      string,

    tournamentId:
      string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id:
            tournamentId,
        },
      });

    if (!tournament) {
      throw new NotFoundException({
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

    await this.authorization.assertCanManageTournamentPermission(userId, tournament.id, 'MANAGE_SETTINGS');

    return tournament;
  }


  private assertDraft(
    status:
      string,
  ) {
    if (
      ![
        'DRAFT',
        'REGISTRATION_CLOSED',
      ].includes(
        status,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_WIZARD_LOCKED',

          message:
            'Close Tournament registration before configuring fixtures.',
        },
      });
    }
  }
}
