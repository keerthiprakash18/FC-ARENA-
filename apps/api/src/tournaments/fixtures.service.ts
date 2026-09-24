import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import type { ScheduleFixtureDto } from './dto/schedule-fixture.dto.js';
import type { UpdateSchedulingSettingsDto } from './dto/update-scheduling-settings.dto.js';
import {
  generateDoubleRoundRobinFixtures,
  generateKnockoutFixtures,
  generateRoundRobinFixtures,
} from './fixture-engine.js';
import type { FixtureBlueprint } from './fixture-engine.js';
import {
  deduplicateFixtureRecords,
} from './fixture-deduplication.js';

@Injectable()
export class FixturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization:
      AuthorizationService,
  ) {}

  async generateFixtures(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );

    if (
      tournament.status !==
      'REGISTRATION_CLOSED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'REGISTRATION_MUST_BE_CLOSED',
          message:
            'Close tournament registration before generating fixtures.',
        },
      });
    }

    const registrations =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,
          status: 'APPROVED',
        },
        orderBy: [
          {
            reviewedAt: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
        select: {
          id: true,
        },
      });

    if (registrations.length < 2) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'NOT_ENOUGH_PARTICIPANTS',
          message:
            'At least 2 approved entries are required to generate fixtures.',
        },
      });
    }

    const registrationIds =
      registrations.map(
        (registration) =>
          registration.id,
      );

    const isDoubleRoundRobin =
      tournament.competitionFormat ===
        'DOUBLE_ROUND_ROBIN' ||
      tournament.legType ===
        'HOME_AWAY';

    const blueprints =
      tournament.format ===
      'ROUND_ROBIN'
        ? isDoubleRoundRobin
          ? generateDoubleRoundRobinFixtures(
              registrationIds,
            )
          : generateRoundRobinFixtures(
              registrationIds,
            )
        : generateKnockoutFixtures(
            registrationIds,
          );

    try {
      const fixtureCount =
        await this.prisma.$transaction(
          async (tx) => {
            const existingCount =
              await tx.fixture.count({
                where: {
                  tournamentId,
                },
              });

            if (existingCount > 0) {
              throw this.fixturesAlreadyGenerated();
            }

            const createdFixtureIds =
              new Map<string, string>();

            let sequence = 1;

            for (
              const blueprint of blueprints
            ) {
              const fixture =
                await tx.fixture.create({
                  data: {
                    fixtureCode:
                      this.createFixtureCode(),

                    tournamentId,

                    sequence,

                    matchday:
                      blueprint.matchday,

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

              createdFixtureIds.set(
                blueprint.key,
                fixture.id,
              );

              await this.connectPreviousFixtures(
                tx,
                blueprint,
                fixture.id,
                createdFixtureIds,
              );

              sequence++;
            }

            await tx.tournament.update({
              where: {
                id: tournamentId,
              },
              data: {
                fixturesGeneratedAt:
                  new Date(),
              },
            });

            return blueprints.length;
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
            'Fixtures generated successfully.',
          format: tournament.format,
          participants:
            registrations.length,
          fixtures: fixtureCount,
        },
        error: null,
      };
    } catch (error) {
      if (
        error instanceof
        ConflictException
      ) {
        throw error;
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw this.fixturesAlreadyGenerated();
      }

      throw error;
    }
  }

  async getFixtures(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
        select: {
          id: true,
          leagueId: true,
          format: true,
          competitionFormat: true,
          legType: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

    await this.ensureMatchesExist(
      tournamentId,
    );

    const fixtures =
      await this.prisma.fixture.findMany({
        where: {
          tournamentId,
        },
        orderBy: {
          sequence: 'asc',
        },
        include: {
          match: true,

          group: {
            select: {
              id: true,
              name: true,
              position: true,
            },
          },

          homeRegistration: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,

                      player: {
                        select: {
                          playerCode: true,

                          identity: {
                            select: {
                              inGameName: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },

          awayRegistration: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,

                      player: {
                        select: {
                          playerCode: true,

                          identity: {
                            select: {
                              inGameName: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },

          previousFixtures: {
            select: {
              id: true,
              fixtureCode: true,
              nextSlot: true,
            },
          },
        },
      });

    const canonicalFixtures =
      deduplicateFixtureRecords(
        fixtures,
        tournament.competitionFormat,
        tournament.legType,
      );

    return {
      success: true,
      data: {
        format: tournament.format,

        fixtures:
          canonicalFixtures.map(
            (fixture) =>
              this.mapFixture(
                fixture,
              ),
          ),
      },
      error: null,
    };
  }

  async updateSchedulingSettings(
    userId: string,
    tournamentId: string,
    dto: UpdateSchedulingSettingsDto,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );

    if (
      dto.dailyMatchLimit ===
        undefined &&
      dto.matchesPerParticipantPerDay ===
        undefined &&
      dto.matchDurationMinutes ===
        undefined
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'NO_SETTINGS_SUBMITTED',
          message:
            'Submit at least one scheduling setting.',
        },
      });
    }

    const updated =
      await this.prisma.tournament.update({
        where: {
          id: tournamentId,
        },
        data: {
          dailyMatchLimit:
            dto.dailyMatchLimit,

          matchesPerParticipantPerDay:
            dto.matchesPerParticipantPerDay,

          matchDurationMinutes:
            dto.matchDurationMinutes,
        },
      });

    return {
      success: true,
      data: {
        message:
          'Scheduling settings updated.',
        settings: {
          dailyMatchLimit:
            updated.dailyMatchLimit,

          matchesPerParticipantPerDay:
            updated.matchesPerParticipantPerDay,

          matchDurationMinutes:
            updated.matchDurationMinutes,
        },
      },
      error: null,
    };
  }

  async scheduleFixture(
    userId: string,
    fixtureId: string,
    dto: ScheduleFixtureDto,
  ) {
    const fixture =
      await this.prisma.fixture.findUnique({
        where: {
          id: fixtureId,
        },
        include: {
          tournament: true,
          match: true,
        },
      });

    if (!fixture) {
      throw this.fixtureNotFound();
    }

    await this.authorization.assertCanManageFixtures(
      userId,
      fixture.tournamentId,
    );

    if (
      fixture.status ===
        'COMPLETED' ||
      fixture.status ===
        'CANCELLED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'FIXTURE_LOCKED',
          message:
            'Completed or cancelled fixtures cannot be scheduled.',
        },
      });
    }

    const scheduledAt =
      new Date(dto.scheduledAt);

    if (
      Number.isNaN(
        scheduledAt.getTime(),
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'INVALID_SCHEDULE_TIME',
          message:
            'Fixture schedule time is invalid.',
        },
      });
    }

    if (
      scheduledAt.getTime() <
      Date.now() - 60_000
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'SCHEDULE_IN_PAST',
          message:
            'A fixture cannot be scheduled in the past.',
        },
      });
    }

    const dayStart =
      new Date(scheduledAt);

    dayStart.setUTCHours(
      0,
      0,
      0,
      0,
    );

    const dayEnd =
      new Date(dayStart);

    dayEnd.setUTCDate(
      dayEnd.getUTCDate() + 1,
    );

    const dayFixtures =
      await this.prisma.fixture.findMany({
        where: {
          tournamentId:
            fixture.tournamentId,

          id: {
            not: fixture.id,
          },

          scheduledAt: {
            gte: dayStart,
            lt: dayEnd,
          },

          status: {
            not: 'CANCELLED',
          },
        },

        select: {
          id: true,
          scheduledAt: true,
          homeRegistrationId: true,
          awayRegistrationId: true,
        },
      });

    if (
      dayFixtures.length >=
      fixture.tournament
        .dailyMatchLimit
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'DAILY_MATCH_LIMIT_REACHED',
          message: `This tournament allows a maximum of ${fixture.tournament.dailyMatchLimit} matches per day.`,
        },
      });
    }

    const participants = [
      fixture.homeRegistrationId,
      fixture.awayRegistrationId,
    ].filter(
      (
        value,
      ): value is string =>
        Boolean(value),
    );

    for (
      const participantId
      of participants
    ) {
      const matchesToday =
        dayFixtures.filter(
          (other) =>
            other.homeRegistrationId ===
              participantId ||
            other.awayRegistrationId ===
              participantId,
        ).length;

      if (
        matchesToday >=
        fixture.tournament
          .matchesPerParticipantPerDay
      ) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code:
              'PARTICIPANT_DAILY_LIMIT_REACHED',

            message:
              `A participant cannot play more than ${fixture.tournament.matchesPerParticipantPerDay} match(es) per day.`,
          },
        });
      }
    }

    const durationMs =
      fixture.tournament
        .matchDurationMinutes *
      60_000;

    const newEnd =
      new Date(
        scheduledAt.getTime() +
          durationMs,
      );

    const overlapStart =
      new Date(
        scheduledAt.getTime() -
          durationMs,
      );

    const overlappingFixtures =
      await this.prisma.fixture.findMany({
        where: {
          tournamentId:
            fixture.tournamentId,

          id: {
            not: fixture.id,
          },

          status: {
            in: [
              'SCHEDULED',
              'LIVE',
            ],
          },

          scheduledAt: {
            gt: overlapStart,
            lt: newEnd,
          },

          ...(participants.length > 0
            ? {
                OR: [
                  {
                    homeRegistrationId:
                      {
                        in: participants,
                      },
                  },
                  {
                    awayRegistrationId:
                      {
                        in: participants,
                      },
                  },
                ],
              }
            : {}),
        },

        select: {
          fixtureCode: true,
        },
      });

    if (
      participants.length > 0 &&
      overlappingFixtures.length >
        0
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'PARTICIPANT_SCHEDULE_CONFLICT',

          message:
            `A participant already has an overlapping fixture (${overlappingFixtures[0].fixtureCode}).`,
        },
      });
    }

    await this.ensureMatchExists(
      fixture.tournamentId,
      fixture.id,
    );

    await this.prisma.$transaction(
      async (tx) => {
        await tx.fixture.update({
          where: {
            id: fixture.id,
          },

          data: {
            scheduledAt,

            venue:
              dto.venue?.trim() ||
              null,

            matchday:
              dto.matchday ??
              fixture.matchday,

            roundNumber:
              dto.roundNumber ??
              fixture.roundNumber,

            roundName:
              dto.roundName?.trim() ||
              fixture.roundName,

            status:
              'SCHEDULED',
          },
        });

        await tx.match.update({
          where: {
            fixtureId:
              fixture.id,
          },

          data: {
            status:
              'SCHEDULED',
          },
        });
      },
    );

    return {
      success: true,
      data: {
        message:
          fixture.scheduledAt
            ? 'Fixture rescheduled successfully.'
            : 'Fixture scheduled successfully.',
      },
      error: null,
    };
  }

  async postponeFixture(
    userId: string,
    fixtureId: string,
  ) {
    const fixture =
      await this.getFixtureForManager(
        userId,
        fixtureId,
      );

    if (
      fixture.status ===
        'COMPLETED' ||
      fixture.status ===
        'CANCELLED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'FIXTURE_LOCKED',
          message:
            'Completed or cancelled fixtures cannot be postponed.',
        },
      });
    }

    await this.ensureMatchExists(
      fixture.tournamentId,
      fixture.id,
    );

    await this.prisma.$transaction([
      this.prisma.fixture.update({
        where: {
          id: fixture.id,
        },
        data: {
          status: 'POSTPONED',
          scheduledAt: null,
        },
      }),

      this.prisma.match.update({
        where: {
          fixtureId:
            fixture.id,
        },
        data: {
          status: 'POSTPONED',
        },
      }),
    ]);

    return {
      success: true,
      data: {
        message:
          'Fixture postponed successfully.',
      },
      error: null,
    };
  }

  async cancelFixture(
    userId: string,
    fixtureId: string,
  ) {
    const fixture =
      await this.getFixtureForManager(
        userId,
        fixtureId,
      );

    if (
      fixture.status ===
      'COMPLETED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'COMPLETED_FIXTURE_LOCKED',

          message:
            'A completed fixture cannot be cancelled.',
        },
      });
    }

    await this.ensureMatchExists(
      fixture.tournamentId,
      fixture.id,
    );

    await this.prisma.$transaction([
      this.prisma.fixture.update({
        where: {
          id: fixture.id,
        },
        data: {
          status: 'CANCELLED',
        },
      }),

      this.prisma.match.update({
        where: {
          fixtureId:
            fixture.id,
        },
        data: {
          status: 'CANCELLED',
        },
      }),
    ]);

    return {
      success: true,
      data: {
        message:
          'Fixture cancelled successfully.',
      },
      error: null,
    };
  }

  private async getFixtureForManager(
    userId: string,
    fixtureId: string,
  ) {
    const fixture =
      await this.prisma.fixture.findUnique({
        where: {
          id: fixtureId,
        },
        include: {
          tournament: true,
        },
      });

    if (!fixture) {
      throw this.fixtureNotFound();
    }

    await this.authorization.assertCanManageFixtures(
      userId,
      fixture.tournamentId,
    );

    return fixture;
  }

  private async ensureMatchesExist(
    tournamentId: string,
  ) {
    const fixtures =
      await this.prisma.fixture.findMany({
        where: {
          tournamentId,
        },
        include: {
          match: true,
        },
      });

    for (
      const fixture of fixtures
    ) {
      if (!fixture.match) {
        await this.ensureMatchExists(
          tournamentId,
          fixture.id,
        );
      }
    }
  }

  private async ensureMatchExists(
    tournamentId: string,
    fixtureId: string,
  ) {
    const existing =
      await this.prisma.match.findUnique({
        where: {
          fixtureId,
        },
      });

    if (existing) {
      return existing;
    }

    try {
      return await this.createMatchForFixture(
        this.prisma,
        tournamentId,
        fixtureId,
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return this.prisma.match.findUniqueOrThrow({
          where: {
            fixtureId,
          },
        });
      }

      throw error;
    }
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
      ).padStart(6, '0')}`;

    return client.match.update({
      where: {
        id: match.id,
      },
      data: {
        matchCode,
      },
    });
  }

  private async connectPreviousFixtures(
    tx: any,
    blueprint: FixtureBlueprint,
    fixtureId: string,
    fixtureIds:
      Map<string, string>,
  ) {
    if (
      blueprint.homeSourceKey
    ) {
      const sourceFixtureId =
        fixtureIds.get(
          blueprint.homeSourceKey,
        );

      if (!sourceFixtureId) {
        throw new Error(
          `Missing source fixture: ${blueprint.homeSourceKey}`,
        );
      }

      await tx.fixture.update({
        where: {
          id: sourceFixtureId,
        },
        data: {
          nextFixtureId:
            fixtureId,
          nextSlot: 'HOME',
        },
      });
    }

    if (
      blueprint.awaySourceKey
    ) {
      const sourceFixtureId =
        fixtureIds.get(
          blueprint.awaySourceKey,
        );

      if (!sourceFixtureId) {
        throw new Error(
          `Missing source fixture: ${blueprint.awaySourceKey}`,
        );
      }

      await tx.fixture.update({
        where: {
          id: sourceFixtureId,
        },
        data: {
          nextFixtureId:
            fixtureId,
          nextSlot: 'AWAY',
        },
      });
    }
  }

  private mapFixture(
    fixture: any,
  ) {
    const homeSource =
      fixture.previousFixtures.find(
        (previous: any) =>
          previous.nextSlot ===
          'HOME',
      );

    const awaySource =
      fixture.previousFixtures.find(
        (previous: any) =>
          previous.nextSlot ===
          'AWAY',
      );

    return {
      id: fixture.id,
      fixtureCode:
        fixture.fixtureCode,
      sequence:
        fixture.sequence,
      matchday:
        fixture.matchday,
      roundNumber:
        fixture.roundNumber,
      roundName:
        fixture.roundName,
      bracketPosition:
        fixture.bracketPosition,
      status:
        fixture.status,
      scheduledAt:
        fixture.scheduledAt,
      venue:
        fixture.venue,

      group:
        fixture.group
          ? {
              id:
                fixture.group.id,

              name:
                fixture.group.name,

              position:
                fixture.group.position,
            }
          : null,

      match: fixture.match
        ? {
            id:
              fixture.match.id,
            matchCode:
              fixture.match
                .matchCode,
            status:
              fixture.match
                .status,
          }
        : null,

      home:
        this.mapRegistration(
          fixture.homeRegistration,
        ),

      away:
        this.mapRegistration(
          fixture.awayRegistration,
        ),

      homeSource:
        homeSource
          ? {
              id:
                homeSource.id,
              fixtureCode:
                homeSource.fixtureCode,
            }
          : null,

      awaySource:
        awaySource
          ? {
              id:
                awaySource.id,
              fixtureCode:
                awaySource.fixtureCode,
            }
          : null,
    };
  }

  private mapRegistration(
    registration: any,
  ) {
    if (!registration) {
      return null;
    }

    return {
      id:
        registration.id,

      entryName:
        registration.entryName,

      members:
        registration.members.map(
          (member: any) => ({
            id:
              member.user.id,

            fullName:
              member.user.fullName,

            playerCode:
              member.user.player
                ?.playerCode ??
              null,

            inGameName:
              member.user.player
                ?.identity
                ?.inGameName ??
              null,
          }),
        ),
    };
  }

  private async assertLeagueMember(
    userId: string,
    leagueId: string,
  ) {
    const membership =
      await this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

    if (!membership) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_MEMBERSHIP_REQUIRED',

          message:
            'You must be a member of this League.',
        },
      });
    }
  }

  private async assertLeagueAdmin(
    userId: string,
    leagueId: string,
  ) {
    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

    if (!admin) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_ADMIN_REQUIRED',

          message:
            'League Admin permission is required.',
        },
      });
    }
  }

  private createFixtureCode() {
    return `FCA-F-${randomUUID()
      .replaceAll('-', '')
      .slice(0, 10)
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

  private fixtureNotFound() {
    return new NotFoundException({
      success: false,
      data: null,
      error: {
        code:
          'FIXTURE_NOT_FOUND',

        message:
          'Fixture could not be found.',
      },
    });
  }

  private fixturesAlreadyGenerated() {
    return new ConflictException({
      success: false,
      data: null,
      error: {
        code:
          'FIXTURES_ALREADY_GENERATED',

        message:
          'Fixtures have already been generated for this tournament.',
      },
    });
  }
}