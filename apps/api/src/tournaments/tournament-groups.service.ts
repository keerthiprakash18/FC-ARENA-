import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomInt,
} from 'node:crypto';

import {
  PrismaService,
} from '../database/prisma.service.js';

import type {
  AssignTournamentGroupDto,
} from './dto/assign-tournament-group.dto.js';

import type {
  CreateTournamentGroupDto,
} from './dto/create-tournament-group.dto.js';

import type {
  DistributeTournamentGroupsDto,
} from './dto/distribute-tournament-groups.dto.js';

import type {
  SetupTournamentGroupsDto,
} from './dto/setup-tournament-groups.dto.js';

import type {
  UpdateTournamentGroupDto,
} from './dto/update-tournament-group.dto.js';


@Injectable()
export class TournamentGroupsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}


  async setupGroups(
    userId: string,
    tournamentId: string,
    dto: SetupTournamentGroupsDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    const groupNames =
      dto.groupNames
        .map(
          (name) =>
            name.trim(),
        )
        .filter(Boolean);

    if (
      groupNames.length <
      2
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'MINIMUM_GROUPS_REQUIRED',

          message:
            'Multiple Group tournaments require at least two groups.',
        },
      });
    }

    this.assertUniqueNames(
      groupNames,
    );

    await this.prisma.$transaction(
      async (
        tx,
      ) => {
        await tx.tournamentRegistration.updateMany({
          where: {
            tournamentId,
          },

          data: {
            groupId:
              null,
          },
        });

        await tx.tournamentGroup.deleteMany({
          where: {
            tournamentId,
          },
        });

        for (
          let index = 0;
          index <
          groupNames.length;
          index++
        ) {
          await tx.tournamentGroup.create({
            data: {
              tournamentId,

              name:
                groupNames[
                  index
                ],

              position:
                index +
                1,
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


  async createGroup(
    userId: string,
    tournamentId: string,
    dto: CreateTournamentGroupDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    if (
      tournament.groupMode !==
      'MULTIPLE_GROUPS'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'MULTIPLE_GROUPS_NOT_ENABLED',

          message:
            'Enable Multiple Groups in Tournament Setup before creating groups.',
        },
      });
    }

    const name =
      dto.name.trim();

    await this.assertUniqueGroupName(
      tournamentId,
      name,
    );

    const existingCount =
      await this.prisma.tournamentGroup.count({
        where: {
          tournamentId,
        },
      });

    if (
      existingCount >=
      16
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'GROUP_LIMIT_REACHED',

          message:
            'A Tournament can contain a maximum of 16 groups.',
        },
      });
    }

    const latest =
      await this.prisma.tournamentGroup.findFirst({
        where: {
          tournamentId,
        },

        orderBy: {
          position:
            'desc',
        },

        select: {
          position: true,
        },
      });

    const group =
      await this.prisma.tournamentGroup.create({
        data: {
          tournamentId,

          name,

          position:
            (latest?.position ??
              0) + 1,
        },
      });

    return {
      success: true,

      data: {
        message:
          `${group.name} created.`,

        group,
      },

      error: null,
    };
  }


  async renameGroup(
    userId: string,
    tournamentId: string,
    groupId: string,
    dto: UpdateTournamentGroupDto,
  ) {
    await this.getTournamentForAdmin(
      userId,
      tournamentId,
    );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    const group =
      await this.getGroup(
        tournamentId,
        groupId,
      );

    const name =
      dto.name.trim();

    await this.assertUniqueGroupName(
      tournamentId,
      name,
      group.id,
    );

    const updated =
      await this.prisma.tournamentGroup.update({
        where: {
          id:
            group.id,
        },

        data: {
          name,
        },
      });

    return {
      success: true,

      data: {
        message:
          'Group renamed successfully.',

        group:
          updated,
      },

      error: null,
    };
  }


  async deleteGroup(
    userId: string,
    tournamentId: string,
    groupId: string,
  ) {
    await this.getTournamentForAdmin(
      userId,
      tournamentId,
    );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    const group =
      await this.getGroup(
        tournamentId,
        groupId,
      );

    const groupCount =
      await this.prisma.tournamentGroup.count({
        where: {
          tournamentId,
        },
      });

    if (
      groupCount <=
      2
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'MINIMUM_GROUPS_REQUIRED',

          message:
            'Multiple Group tournaments must keep at least two groups.',
        },
      });
    }

    const entryCount =
      await this.prisma.tournamentRegistration.count({
        where: {
          tournamentId,

          groupId:
            group.id,
        },
      });

    await this.prisma.$transaction(
      async (
        tx,
      ) => {
        await tx.tournamentRegistration.updateMany({
          where: {
            tournamentId,

            groupId:
              group.id,
          },

          data: {
            groupId:
              null,
          },
        });

        await tx.tournamentGroup.delete({
          where: {
            id:
              group.id,
          },
        });

        const remaining =
          await tx.tournamentGroup.findMany({
            where: {
              tournamentId,
            },

            orderBy: {
              position:
                'asc',
            },

            select: {
              id: true,
            },
          });

        for (
          let index = 0;
          index <
          remaining.length;
          index++
        ) {
          await tx.tournamentGroup.update({
            where: {
              id:
                remaining[
                  index
                ].id,
            },

            data: {
              position:
                index +
                1,
            },
          });
        }
      },
    );

    return {
      success: true,

      data: {
        message:
          `${group.name} deleted. ${entryCount} team(s) returned to Unassigned.`,
      },

      error: null,
    };
  }


  async distributeGroups(
    userId: string,
    tournamentId: string,
    dto: DistributeTournamentGroupsDto,
  ) {
    await this.getTournamentForAdmin(
      userId,
      tournamentId,
    );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    const groups =
      await this.prisma.tournamentGroup.findMany({
        where: {
          tournamentId,
        },

        orderBy: {
          position:
            'asc',
        },
      });

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
            'Create at least two groups before distributing teams.',
        },
      });
    }

    const entries =
      await this.prisma.tournamentRegistration.findMany({
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

        select: {
          id: true,
        },
      });

    if (
      entries.length ===
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'NO_APPROVED_ENTRIES',

          message:
            'Add Tournament teams before distributing groups.',
        },
      });
    }

    const registrationIds =
      entries.map(
        (entry) =>
          entry.id,
      );

    if (
      dto.mode ===
      'RANDOM_DRAW'
    ) {
      this.shuffle(
        registrationIds,
      );
    }

    await this.prisma.$transaction(
      registrationIds.map(
        (
          registrationId,
          index,
        ) =>
          this.prisma.tournamentRegistration.update({
            where: {
              id:
                registrationId,
            },

            data: {
              groupId:
                groups[
                  index %
                  groups.length
                ].id,
            },
          }),
      ),
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
          dto.mode ===
          'RANDOM_DRAW'
            ? 'Random group draw completed.'
            : 'Teams distributed evenly across groups.',

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
          id:
            tournamentId,
        },

        select: {
          id: true,
          leagueId: true,
          name: true,
          groupMode: true,
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
          position:
            'asc',
        },

        include: {
          registrations: {
            where: {
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

          status:
            'APPROVED',

          groupId:
            null,
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

          groupMode:
            tournament.groupMode,
        },

        groups:
          groups.map(
            (
              group,
            ) => ({
              id:
                group.id,

              name:
                group.name,

              position:
                group.position,

              entries:
                group.registrations.map(
                  (
                    registration,
                  ) =>
                    this.mapRegistration(
                      registration,
                    ),
                ),
            }),
          ),

        unassigned:
          unassigned.map(
            (
              registration,
            ) =>
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
    await this.getTournamentForAdmin(
      userId,
      tournamentId,
    );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    const group =
      await this.getGroup(
        tournamentId,
        dto.groupId,
      );

    const registration =
      await this.prisma.tournamentRegistration.findUnique({
        where: {
          id:
            registrationId,
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
            'Tournament team could not be found.',
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
            'Only approved Tournament teams can be assigned to groups.',
        },
      });
    }

    await this.prisma.tournamentRegistration.update({
      where: {
        id:
          registration.id,
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
          `Team moved to ${group.name}.`,
      },

      error: null,
    };
  }


  async unassignRegistration(
    userId: string,
    tournamentId: string,
    registrationId: string,
  ) {
    await this.getTournamentForAdmin(
      userId,
      tournamentId,
    );

    await this.assertGroupsUnlocked(
      tournamentId,
    );

    const registration =
      await this.prisma.tournamentRegistration.findUnique({
        where: {
          id:
            registrationId,
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
            'Tournament team could not be found.',
        },
      });
    }

    await this.prisma.tournamentRegistration.update({
      where: {
        id:
          registration.id,
      },

      data: {
        groupId:
          null,
      },
    });

    return {
      success: true,

      data: {
        message:
          'Team returned to Unassigned.',
      },

      error: null,
    };
  }


  private async getTournamentForAdmin(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id:
            tournamentId,
        },

        select: {
          id: true,
          leagueId: true,
          groupMode: true,
          status: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );

    return tournament;
  }


  private async getGroup(
    tournamentId: string,
    groupId: string,
  ) {
    const group =
      await this.prisma.tournamentGroup.findUnique({
        where: {
          id:
            groupId,
        },
      });

    if (
      !group ||
      group.tournamentId !==
        tournamentId
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

    return group;
  }


  private async assertUniqueGroupName(
    tournamentId: string,
    name: string,
    ignoreGroupId?: string,
  ) {
    const groups =
      await this.prisma.tournamentGroup.findMany({
        where: {
          tournamentId,

          ...(ignoreGroupId
            ? {
                id: {
                  not:
                    ignoreGroupId,
                },
              }
            : {}),
        },

        select: {
          name: true,
        },
      });

    const normalized =
      name
        .trim()
        .toLocaleLowerCase();

    if (
      groups.some(
        (
          group,
        ) =>
          group.name
            .trim()
            .toLocaleLowerCase() ===
          normalized,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'DUPLICATE_GROUP_NAME',

          message:
            'A group with this name already exists.',
        },
      });
    }
  }


  private assertUniqueNames(
    names: string[],
  ) {
    const normalized =
      names.map(
        (
          name,
        ) =>
          name
            .trim()
            .toLocaleLowerCase(),
      );

    if (
      new Set(
        normalized,
      ).size !==
      normalized.length
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'DUPLICATE_GROUP_NAME',

          message:
            'Every Tournament group must have a unique name.',
        },
      });
    }
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

    if (
      fixtureCount >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_GROUPS_LOCKED',

          message:
            'Groups cannot be changed after fixtures have been generated. Reset fixtures first.',
        },
      });
    }
  }


  private shuffle(
    values: string[],
  ) {
    for (
      let index =
        values.length -
        1;
      index >
      0;
      index--
    ) {
      const swapIndex =
        randomInt(
          0,
          index +
            1,
        );

      [
        values[
          index
        ],
        values[
          swapIndex
        ],
      ] = [
        values[
          swapIndex
        ],
        values[
          index
        ],
      ];
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

      entryLogoUrl:
        registration.entryLogoUrl ??
        null,

      groupId:
        registration.groupId,

      members:
        registration.members.map(
          (
            member: any,
          ) => ({
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
            'You must be a League member to access Tournament groups.',
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
            'League Admin permission is required to manage Tournament groups.',
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