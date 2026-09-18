import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateLeagueDto } from './dto/create-league.dto.js';

const LEAGUE_MEMBER_LIMIT = 100;
const PLAYER_LEAGUE_LIMIT = 2;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  async createLeague(userId: string, dto: CreateLeagueDto) {
    const existingMemberships = await this.prisma.leagueMember.count({
      where: { userId },
    });

    if (existingMemberships >= PLAYER_LEAGUE_LIMIT) {
      throw this.leagueLimitReached();
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = await this.generateUniqueLeagueCode(dto.name);

      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const membershipCount = await tx.leagueMember.count({
              where: { userId },
            });

            if (membershipCount >= PLAYER_LEAGUE_LIMIT) {
              throw this.leagueLimitReached();
            }

            const league = await tx.league.create({
              data: {
                name: dto.name.trim(),
                code,
                logoUrl: dto.logoUrl?.trim() || null,
                description: dto.description?.trim() || null,
                region: dto.region?.trim() || null,
                rules: dto.rules?.trim() || null,
                maxMembers: LEAGUE_MEMBER_LIMIT,
                creatorUserId: userId,
              },
            });

            await tx.leagueMember.create({
              data: {
                leagueId: league.id,
                userId,
                type:
                  membershipCount === 0
                    ? 'PRIMARY'
                    : 'SECONDARY',
              },
            });

            await tx.leagueAdmin.create({
              data: {
                leagueId: league.id,
                userId,
                role: 'OWNER',
              },
            });

            return league;
          },
          {
            isolationLevel: 'Serializable',
          },
        );

        return {
          success: true,
          data: {
            message: 'League created successfully.',
            league: result,
          },
          error: null,
        };
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException({
      success: false,
      data: null,
      error: {
        code: 'LEAGUE_CODE_GENERATION_FAILED',
        message: 'Unable to generate a unique League Code. Try again.',
      },
    });
  }

  async getMyLeagues(userId: string) {
    const memberships = await this.prisma.leagueMember.findMany({
      where: { userId },
      orderBy: [
        {
          type: 'asc',
        },
        {
          joinedAt: 'asc',
        },
      ],
      include: {
        league: {
          include: {
            admins: {
              where: { userId },
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
        },
      },
    });

    return {
      success: true,
      data: {
        leagues: memberships.map((membership) => ({
          membershipType: membership.type,
          joinedAt: membership.joinedAt,
          adminRole: membership.league.admins[0]?.role ?? null,
          league: {
            id: membership.league.id,
            name: membership.league.name,
            code: membership.league.code,
            logoUrl: membership.league.logoUrl,
            description: membership.league.description,
            region: membership.league.region,
            rules: membership.league.rules,
            members: membership.league._count.members,
            maxMembers: membership.league.maxMembers,
            pendingApplications:
              membership.league._count.applications,
            creatorUserId: membership.league.creatorUserId,
          },
        })),
      },
      error: null,
    };
  }

  async previewByCode(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();

    const league = await this.prisma.league.findUnique({
      where: { code },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
        members: {
          where: { userId },
          select: {
            id: true,
            type: true,
          },
        },
        applications: {
          where: { userId },
          select: {
            status: true,
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
          message: 'No League exists with this League Code.',
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
          members: league._count.members,
          maxMembers: league.maxMembers,
          alreadyMember: league.members.length > 0,
          applicationStatus:
            league.applications[0]?.status ?? null,
        },
      },
      error: null,
    };
  }

  async requestToJoin(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();

    const league = await this.prisma.league.findUnique({
      where: { code },
      include: {
        _count: {
          select: {
            members: true,
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
          message: 'No League exists with this League Code.',
        },
      });
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId: league.id,
          userId,
        },
      },
    });

    if (membership) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'ALREADY_LEAGUE_MEMBER',
          message: 'You are already a member of this League.',
        },
      });
    }

    const membershipCount = await this.prisma.leagueMember.count({
      where: { userId },
    });

    if (membershipCount >= PLAYER_LEAGUE_LIMIT) {
      throw this.leagueLimitReached();
    }

    if (league._count.members >= league.maxMembers) {
      throw this.leagueFull();
    }

    const existingApplication =
      await this.prisma.leagueApplication.findUnique({
        where: {
          leagueId_userId: {
            leagueId: league.id,
            userId,
          },
        },
      });

    if (existingApplication?.status === 'PENDING') {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'APPLICATION_ALREADY_PENDING',
          message: 'Your League join request is already pending.',
        },
      });
    }

    if (existingApplication?.status === 'APPROVED') {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'APPLICATION_ALREADY_APPROVED',
          message: 'This League application was already approved.',
        },
      });
    }

    const application = existingApplication
      ? await this.prisma.leagueApplication.update({
          where: {
            id: existingApplication.id,
          },
          data: {
            status: 'PENDING',
            reviewedAt: null,
            reviewedByUserId: null,
          },
        })
      : await this.prisma.leagueApplication.create({
          data: {
            leagueId: league.id,
            userId,
            status: 'PENDING',
          },
        });

    return {
      success: true,
      data: {
        message:
          'League join request submitted. An admin must approve it.',
        application,
      },
      error: null,
    };
  }

  async getApplications(adminUserId: string, leagueId: string) {
    await this.assertLeagueAdmin(adminUserId, leagueId);

    const applications =
      await this.prisma.leagueApplication.findMany({
        where: {
          leagueId,
          status: 'PENDING',
        },
        orderBy: {
          createdAt: 'asc',
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
                  identity: {
                    select: {
                      inGameName: true,
                      gameUid: true,
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
        applications,
      },
      error: null,
    };
  }

  async approveApplication(
    adminUserId: string,
    leagueId: string,
    applicationId: string,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const admin = await tx.leagueAdmin.findUnique({
          where: {
            leagueId_userId: {
              leagueId,
              userId: adminUserId,
            },
          },
        });

        if (!admin) {
          throw this.adminRequired();
        }

        const application =
          await tx.leagueApplication.findUnique({
            where: { id: applicationId },
            include: {
              league: true,
            },
          });

        if (
          !application ||
          application.leagueId !== leagueId
        ) {
          throw new NotFoundException({
            success: false,
            data: null,
            error: {
              code: 'APPLICATION_NOT_FOUND',
              message: 'League application could not be found.',
            },
          });
        }

        if (application.status !== 'PENDING') {
          throw new ConflictException({
            success: false,
            data: null,
            error: {
              code: 'APPLICATION_NOT_PENDING',
              message: 'This application is no longer pending.',
            },
          });
        }

        const [leagueMemberCount, playerLeagueCount] =
          await Promise.all([
            tx.leagueMember.count({
              where: {
                leagueId,
              },
            }),
            tx.leagueMember.count({
              where: {
                userId: application.userId,
              },
            }),
          ]);

        if (
          leagueMemberCount >= application.league.maxMembers
        ) {
          throw this.leagueFull();
        }

        if (playerLeagueCount >= PLAYER_LEAGUE_LIMIT) {
          throw this.leagueLimitReached();
        }

        const membership = await tx.leagueMember.create({
          data: {
            leagueId,
            userId: application.userId,
            type:
              playerLeagueCount === 0
                ? 'PRIMARY'
                : 'SECONDARY',
          },
        });

        await tx.leagueApplication.update({
          where: {
            id: application.id,
          },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedByUserId: adminUserId,
          },
        });

        return membership;
      },
      {
        isolationLevel: 'Serializable',
      },
    );

    return {
      success: true,
      data: {
        message: 'League application approved.',
        membership: result,
      },
      error: null,
    };
  }

  async rejectApplication(
    adminUserId: string,
    leagueId: string,
    applicationId: string,
  ) {
    await this.assertLeagueAdmin(adminUserId, leagueId);

    const application =
      await this.prisma.leagueApplication.findUnique({
        where: {
          id: applicationId,
        },
      });

    if (
      !application ||
      application.leagueId !== leagueId
    ) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'League application could not be found.',
        },
      });
    }

    if (application.status !== 'PENDING') {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'APPLICATION_NOT_PENDING',
          message: 'This application is no longer pending.',
        },
      });
    }

    await this.prisma.leagueApplication.update({
      where: {
        id: application.id,
      },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
      },
    });

    return {
      success: true,
      data: {
        message: 'League application rejected.',
      },
      error: null,
    };
  }

  async setPrimary(userId: string, leagueId: string) {
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
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_MEMBERSHIP_NOT_FOUND',
          message: 'You are not a member of this League.',
        },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.leagueMember.updateMany({
        where: {
          userId,
          type: 'PRIMARY',
        },
        data: {
          type: 'SECONDARY',
        },
      });

      await tx.leagueMember.update({
        where: {
          id: membership.id,
        },
        data: {
          type: 'PRIMARY',
        },
      });
    });

    return {
      success: true,
      data: {
        message: 'Primary League updated successfully.',
      },
      error: null,
    };
  }

  async leaveLeague(userId: string, leagueId: string) {
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

    if (league.creatorUserId === userId) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_OWNER_CANNOT_LEAVE',
          message:
            'The League owner cannot leave until ownership transfer is supported.',
        },
      });
    }

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
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_MEMBERSHIP_NOT_FOUND',
          message: 'You are not a member of this League.',
        },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.leagueMember.delete({
        where: {
          id: membership.id,
        },
      });

      if (membership.type === 'PRIMARY') {
        const remaining =
          await tx.leagueMember.findFirst({
            where: {
              userId,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          });

        if (remaining) {
          await tx.leagueMember.update({
            where: {
              id: remaining.id,
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
        message:
          'You left the League. The League itself was not deleted.',
      },
      error: null,
    };
  }

  private async assertLeagueAdmin(
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
      throw this.adminRequired();
    }
  }

  private async generateUniqueLeagueCode(
    leagueName: string,
  ): Promise<string> {
    const words = leagueName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    let prefix = words
      .map((word) => word[0])
      .join('')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase();

    if (prefix.length < 2) {
      prefix = leagueName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase();
    }

    if (prefix.length < 2) {
      prefix = 'FCA';
    }

    for (let attempt = 0; attempt < 20; attempt++) {
      let suffix = '';

      for (let i = 0; i < 5; i++) {
        suffix +=
          CODE_ALPHABET[
            randomInt(0, CODE_ALPHABET.length)
          ];
      }

      const code = `${prefix}-${suffix}`;

      const exists = await this.prisma.league.findUnique({
        where: { code },
        select: { id: true },
      });

      if (!exists) {
        return code;
      }
    }

    throw new ConflictException({
      success: false,
      data: null,
      error: {
        code: 'LEAGUE_CODE_GENERATION_FAILED',
        message: 'Unable to generate a unique League Code.',
      },
    });
  }

  private leagueLimitReached() {
    return new ConflictException({
      success: false,
      data: null,
      error: {
        code: 'LEAGUE_LIMIT_REACHED',
        message:
          'You can join a maximum of 2 leagues. Leave one of your current leagues before joining another.',
      },
    });
  }

  private leagueFull() {
    return new ConflictException({
      success: false,
      data: null,
      error: {
        code: 'LEAGUE_FULL',
        message:
          'This League has reached its maximum capacity of 100 members.',
      },
    });
  }

  private adminRequired() {
    return new ForbiddenException({
      success: false,
      data: null,
      error: {
        code: 'LEAGUE_ADMIN_REQUIRED',
        message:
          'You do not have permission to perform this League action.',
      },
    });
  }
}