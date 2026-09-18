import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  AuditService,
} from './audit.service.js';

import {
  AuthorizationService,
} from './authorization.service.js';

import type {
  AssignRoleDto,
} from './dto/assign-role.dto.js';

@Injectable()
export class RoleManagementService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly authorization:
      AuthorizationService,

    private readonly audit:
      AuditService,
  ) {}

  async assignRole(
    actorUserId: string,
    dto: AssignRoleDto,
  ) {
    await this.assertCanManageScope(
      actorUserId,
      dto.scopeType,
      dto.scopeId,
    );

    const targetUser =
      await this.prisma.user.findUnique({
        where: {
          id: dto.userId,
        },

        select: {
          id: true,
          fullName: true,
        },
      });

    if (!targetUser) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'USER_NOT_FOUND',

          message:
            'Target user could not be found.',
        },
      });
    }

    await this.assertScopeExists(
      dto.scopeType,
      dto.scopeId,
    );

    const existing =
      await this.prisma.roleAssignment.findUnique({
        where: {
          userId_role_scopeType_scopeId: {
            userId:
              dto.userId,

            role:
              dto.role,

            scopeType:
              dto.scopeType,

            scopeId:
              dto.scopeId,
          },
        },
      });

    if (existing) {
      return {
        success: true,

        data: {
          assignment:
            existing,

          message:
            'Role is already assigned.',
        },

        error: null,
      };
    }

    const assignment =
      await this.prisma.roleAssignment.create({
        data: {
          userId:
            dto.userId,

          role:
            dto.role,

          scopeType:
            dto.scopeType,

          scopeId:
            dto.scopeId,

          assignedByUserId:
            actorUserId,
        },
      });

    await this.audit.record({
      actorUserId,

      action:
        'PERMISSION_ASSIGNED',

      targetType:
        'RoleAssignment',

      targetId:
        assignment.id,

      scopeType:
        dto.scopeType,

      scopeId:
        dto.scopeId,

      beforeData: null,

      afterData: {
        userId:
          dto.userId,

        role:
          dto.role,

        scopeType:
          dto.scopeType,

        scopeId:
          dto.scopeId,
      },

      metadata: {
        targetUserName:
          targetUser.fullName,
      },
    });

    return {
      success: true,

      data: {
        assignment,

        message:
          'Role assigned successfully.',
      },

      error: null,
    };
  }

  async removeRole(
    actorUserId: string,
    assignmentId: string,
  ) {
    const assignment =
      await this.prisma.roleAssignment.findUnique({
        where: {
          id:
            assignmentId,
        },

        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

    if (!assignment) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'ROLE_ASSIGNMENT_NOT_FOUND',

          message:
            'Role assignment could not be found.',
        },
      });
    }

    await this.assertCanManageScope(
      actorUserId,
      assignment.scopeType,
      assignment.scopeId,
    );

    const beforeData = {
      id:
        assignment.id,

      userId:
        assignment.userId,

      role:
        assignment.role,

      scopeType:
        assignment.scopeType,

      scopeId:
        assignment.scopeId,

      assignedByUserId:
        assignment.assignedByUserId,

      createdAt:
        assignment.createdAt,
    };

    await this.prisma.roleAssignment.delete({
      where: {
        id:
          assignment.id,
      },
    });

    await this.audit.record({
      actorUserId,

      action:
        'PERMISSION_REMOVED',

      targetType:
        'RoleAssignment',

      targetId:
        assignment.id,

      scopeType:
        assignment.scopeType,

      scopeId:
        assignment.scopeId,

      beforeData,

      afterData: null,

      metadata: {
        targetUserId:
          assignment.user.id,

        targetUserName:
          assignment.user.fullName,
      },
    });

    return {
      success: true,

      data: {
        message:
          'Role removed successfully.',
      },

      error: null,
    };
  }

  async listScopeRoles(
    actorUserId: string,
    scopeType:
      | 'GLOBAL'
      | 'LEAGUE'
      | 'TOURNAMENT',
    scopeId: string,
  ) {
    await this.assertCanManageScope(
      actorUserId,
      scopeType,
      scopeId,
    );

    const assignments =
      await this.prisma.roleAssignment.findMany({
        where: {
          scopeType,
          scopeId,
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
                    },
                  },
                },
              },
            },
          },

          assignedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },

        orderBy: [
          {
            role:
              'asc',
          },
          {
            createdAt:
              'asc',
          },
        ],
      });

    return {
      success: true,

      data: {
        scopeType,
        scopeId,
        assignments,
      },

      error: null,
    };
  }

  async getMyAccess(
    userId: string,
  ) {
    const access =
      await this.authorization.getEffectiveAccess(
        userId,
      );

    return {
      success: true,

      data: {
        access,
      },

      error: null,
    };
  }

  async getAuditForScope(
    actorUserId: string,
    scopeType:
      | 'GLOBAL'
      | 'LEAGUE'
      | 'TOURNAMENT',
    scopeId: string,
  ) {
    await this.assertCanManageScope(
      actorUserId,
      scopeType,
      scopeId,
    );

    const logs =
      await this.audit.listForScope(
        scopeType,
        scopeId,
        200,
      );

    return {
      success: true,

      data: {
        scopeType,
        scopeId,
        logs,
      },

      error: null,
    };
  }

  private async assertCanManageScope(
    actorUserId: string,
    scopeType:
      | 'GLOBAL'
      | 'LEAGUE'
      | 'TOURNAMENT',
    scopeId: string,
  ) {
    if (
      await this.authorization.isSuperAdmin(
        actorUserId,
      )
    ) {
      return;
    }

    if (
      scopeType ===
      'GLOBAL'
    ) {
      throw this.denied();
    }

    if (
      scopeType ===
      'LEAGUE'
    ) {
      const allowed =
        await this.authorization.isLeagueAdmin(
          actorUserId,
          scopeId,
        );

      if (!allowed) {
        throw this.denied();
      }

      return;
    }

    const allowed =
      await this.authorization.canManageTournament(
        actorUserId,
        scopeId,
      );

    if (!allowed) {
      throw this.denied();
    }
  }

  private async assertScopeExists(
    scopeType:
      | 'GLOBAL'
      | 'LEAGUE'
      | 'TOURNAMENT',
    scopeId: string,
  ) {
    if (
      scopeType ===
      'GLOBAL'
    ) {
      return;
    }

    if (
      scopeType ===
      'LEAGUE'
    ) {
      const league =
        await this.prisma.league.findUnique({
          where: {
            id:
              scopeId,
          },

          select: {
            id: true,
          },
        });

      if (!league) {
        throw new NotFoundException({
          success: false,
          data: null,

          error: {
            code:
              'LEAGUE_NOT_FOUND',

            message:
              'League could not be found.',
          },
        });
      }

      return;
    }

    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id:
            scopeId,
        },

        select: {
          id: true,
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
  }

  private denied() {
    return new ForbiddenException({
      success: false,
      data: null,

      error: {
        code:
          'PERMISSION_DENIED',

        message:
          'You do not have permission to manage roles in this scope.',
      },
    });
  }
}