import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { SetupTournamentGroupsDto } from './dto/setup-tournament-groups.dto.js';
import type { AssignTournamentGroupDto } from './dto/assign-tournament-group.dto.js';

@Injectable()
export class TournamentGroupsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async setupGroups(
    userId: string,
    tournamentId: string,
    dto: SetupTournamentGroupsDto,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
        select: {
          id: true,
          leagueId: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    const groupNames =
      dto.groupNames.map(
        (name) => name.trim(),
      );

    const normalized =
      groupNames.map(
        (name) =>
          name.toLocaleLowerCase(),
      );

    if (
      new Set(normalized).size !==
      normalized.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'DUPLICATE_GROUP_NAME',
          message:
            'Every tournament group must have a unique name.',
        },
      });
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.tournamentRegistration.updateMany({
          where: {
            tournamentId,
          },
          data: {
            groupId: null,
          },
        });

        await tx.tournamentGroup.deleteMany({
          where: {
            tournamentId,
          },
        });

        for (
          let index = 0;
          index < groupNames.length;
          index++
        ) {
          await tx.tournamentGroup.create({
            data: {
              tournamentId,
              name:
                groupNames[index],
              position:
                index + 1,
            },
          });
        }
      },
    );

    const result =
      await this.getGroups(
        userId,
        tournamentId,
      );

    return {
      success: true,
      data: {
        message:
          'Tournament groups configured successfully.',
        groups:
          result.data.groups,
        unassigned:
          result.data.unassigned,
      },
      error: null,
    };
  }

  async getGroups(
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
          name: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

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
            orderBy: {
              reviewedAt: 'asc',
            },
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
        },
      });

    const unassigned =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,
          status: 'APPROVED',
          groupId: null,
        },
        orderBy: {
          reviewedAt: 'asc',
        },
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
      });

    return {
      success: true,
      data: {
        tournament: {
          id:
            tournament.id,
          name:
            tournament.name,
        },

        groups:
          groups.map(
            (group) => ({
              id:
                group.id,
              name:
                group.name,
              position:
                group.position,
              entries:
                group.registrations.map(
                  (registration) =>
                    this.mapRegistration(
                      registration,
                    ),
                ),
            }),
          ),

        unassigned:
          unassigned.map(
            (registration) =>
              this.mapRegistration(
                registration,
              ),
          ),
      },
      error: null,
    };
  }

  async assignRegistration(
    userId: string,
    tournamentId: string,
    registrationId: string,
    dto: AssignTournamentGroupDto,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
        select: {
          leagueId: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    const group =
      await this.prisma.tournamentGroup.findUnique({
        where: {
          id: dto.groupId,
        },
      });

    if (
      !group ||
      group.tournamentId !== tournamentId
    ) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_GROUP_NOT_FOUND',
          message:
            'Tournament group could not be found.',
        },
      });
    }

    const registration =
      await this.prisma.tournamentRegistration.findUnique({
        where: {
          id: registrationId,
        },
      });

    if (
      !registration ||
      registration.tournamentId !==
        tournamentId
    ) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'REGISTRATION_NOT_FOUND',
          message:
            'Tournament registration could not be found.',
        },
      });
    }

    if (
      registration.status !==
      'APPROVED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'REGISTRATION_NOT_APPROVED',
          message:
            'Only approved tournament entries can be assigned to groups.',
        },
      });
    }

    const updated =
      await this.prisma.tournamentRegistration.update({
        where: {
          id: registrationId,
        },
        data: {
          groupId:
            group.id,
        },
      });

    return {
      success: true,
      data: {
        message:
          `Entry moved to ${group.name}.`,
        registration: {
          id:
            updated.id,
          groupId:
            updated.groupId,
        },
      },
      error: null,
    };
  }

  async unassignRegistration(
    userId: string,
    tournamentId: string,
    registrationId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
        select: {
          leagueId: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    const registration =
      await this.prisma.tournamentRegistration.findUnique({
        where: {
          id: registrationId,
        },
      });

    if (
      !registration ||
      registration.tournamentId !==
        tournamentId
    ) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'REGISTRATION_NOT_FOUND',
          message:
            'Tournament registration could not be found.',
        },
      });
    }

    await this.prisma.tournamentRegistration.update({
      where: {
        id: registrationId,
      },
      data: {
        groupId: null,
      },
    });

    return {
      success: true,
      data: {
        message:
          'Entry returned to the unassigned list.',
      },
      error: null,
    };
  }

  private async assertGroupsUnlocked(
    tournamentId: string,
  ) {
    const fixtureCount =
      await this.prisma.fixture.count({
        where: {
          tournamentId,
        },
      });

    if (fixtureCount > 0) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_GROUPS_LOCKED',
          message:
            'Groups cannot be changed after fixtures have been generated.',
        },
      });
    }
  }

  private mapRegistration(
    registration: any,
  ) {
    return {
      id:
        registration.id,

      entryName:
        registration.entryName,

      groupId:
        registration.groupId,

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
            'You must be a League member to access tournament groups.',
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
            'League Admin permission is required to manage tournament groups.',
        },
      });
    }
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
