import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class LeagueManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeagueHome(userId: string, leagueId: string) {
    const membership = await this.prisma.leagueMember.findUnique({
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
          code: 'LEAGUE_MEMBERSHIP_REQUIRED',
          message: 'You must be a member of this League.',
        },
      });
    }

    const league = await this.prisma.league.findUnique({
      where: {
        id: leagueId,
      },
      include: {
        creator: {
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
        admins: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
        },
        _count: {
          select: {
            members: true,
            applications: {
              where: {
                status: 'PENDING',
              },
            },
          },
        },
      },
    });

    if (!league) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_NOT_FOUND',
          message: 'League could not be found.',
        },
      });
    }

    return {
      success: true,
      data: {
        league: {
          id: league.id,
          name: league.name,
          code: league.code,
          logoUrl: league.logoUrl,
          description: league.description,
          region: league.region,
          rules: league.rules,
          members: league._count.members,
          maxMembers: league.maxMembers,
          pendingApplications: league._count.applications,
          membershipType: membership.type,
          adminRole: league.admins[0]?.role ?? null,
          creator: {
            id: league.creator.id,
            fullName: league.creator.fullName,
            playerCode: league.creator.player?.playerCode ?? null,
            inGameName:
              league.creator.player?.identity?.inGameName ?? null,
          },
          createdAt: league.createdAt,
        },
      },
      error: null,
    };
  }

  async getMembers(
    userId: string,
    leagueId: string,
    search?: string,
  ) {
    await this.assertMember(userId, leagueId);

    const normalizedSearch = search?.trim();

    const members = await this.prisma.leagueMember.findMany({
      where: {
        leagueId,
        ...(normalizedSearch
          ? {
              user: {
                OR: [
                  {
                    fullName: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    email: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    player: {
                      is: {
                        identity: {
                          is: {
                            inGameName: {
                              contains: normalizedSearch,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            }
          : {}),
      },
      orderBy: {
        joinedAt: 'asc',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            player: {
              select: {
                playerCode: true,
                profileImageUrl: true,
                identity: {
                  select: {
                    inGameName: true,
                    gameUid: true,
                    isVerified: true,
                  },
                },
              },
            },
            leagueAdminRoles: {
              where: {
                leagueId,
              },
              select: {
                role: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: {
        members: members.map((membership) => ({
          membershipId: membership.id,
          membershipType: membership.type,
          joinedAt: membership.joinedAt,
          user: {
            id: membership.user.id,
            fullName: membership.user.fullName,
            email: membership.user.email,
            playerCode:
              membership.user.player?.playerCode ?? null,
            profileImageUrl:
              membership.user.player?.profileImageUrl ?? null,
            inGameName:
              membership.user.player?.identity?.inGameName ?? null,
            gameUid:
              membership.user.player?.identity?.gameUid ?? null,
            identityVerified:
              membership.user.player?.identity?.isVerified ?? false,
            adminRole:
              membership.user.leagueAdminRoles[0]?.role ?? null,
          },
        })),
      },
      error: null,
    };
  }

  async removeMember(
    adminUserId: string,
    leagueId: string,
    memberUserId: string,
  ) {
    await this.assertAdmin(adminUserId, leagueId);

    const league = await this.prisma.league.findUnique({
      where: {
        id: leagueId,
      },
    });

    if (!league) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_NOT_FOUND',
          message: 'League could not be found.',
        },
      });
    }

    if (league.creatorUserId === memberUserId) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_OWNER_CANNOT_BE_REMOVED',
          message: 'The League owner cannot be removed.',
        },
      });
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId: memberUserId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_MEMBER_NOT_FOUND',
          message: 'This player is not a member of the League.',
        },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.leagueAdmin.deleteMany({
        where: {
          leagueId,
          userId: memberUserId,
        },
      });

      await tx.leagueMember.delete({
        where: {
          id: membership.id,
        },
      });

      if (membership.type === 'PRIMARY') {
        const remainingMembership =
          await tx.leagueMember.findFirst({
            where: {
              userId: memberUserId,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          });

        if (remainingMembership) {
          await tx.leagueMember.update({
            where: {
              id: remainingMembership.id,
            },
            data: {
              type: 'PRIMARY',
            },
          });
        }
      }
    });

    return {
      success: true,
      data: {
        message: 'League member removed successfully.',
      },
      error: null,
    };
  }

  private async assertMember(
    userId: string,
    leagueId: string,
  ): Promise<void> {
    const membership = await this.prisma.leagueMember.findUnique({
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
          code: 'LEAGUE_MEMBERSHIP_REQUIRED',
          message: 'You must be a member of this League.',
        },
      });
    }
  }

  private async assertAdmin(
    userId: string,
    leagueId: string,
  ): Promise<void> {
    const admin = await this.prisma.leagueAdmin.findUnique({
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
          code: 'LEAGUE_ADMIN_REQUIRED',
          message:
            'You do not have permission to manage League members.',
        },
      });
    }
  }
}