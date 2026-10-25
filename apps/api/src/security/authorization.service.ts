import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

type ScopedRoleName =
  | 'TOURNAMENT_ADMIN'
  | 'TEAM_MANAGER'
  | 'CAPTAIN'
  | 'PLAYER'
  | 'MATCH_OFFICIAL'
  | 'VIEWER';

type LeagueAdminPermissionName =
  | 'MANAGE_SETTINGS'
  | 'MANAGE_MEMBERS'
  | 'MANAGE_FIXTURES'
  | 'MANAGE_STANDINGS'
  | 'MANAGE_TOURNAMENTS'
  | 'VIEW_REPORTS';

type TournamentAdminPermissionName =
  | 'MANAGE_FIXTURES'
  | 'MANAGE_RESULTS'
  | 'VERIFY_SCORES'
  | 'MANAGE_PARTICIPANTS'
  | 'MANAGE_SETTINGS'
  | 'VIEW_REPORTS';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async isSuperAdmin(
    userId: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          role: true,
        },
      });

    return (
      user?.role ===
      'SUPER_ADMIN'
    );
  }

  async isLeagueAdmin(
    userId: string,
    leagueId: string,
  ) {
    if (
      await this.isSuperAdmin(
        userId,
      )
    ) {
      return true;
    }

    const leagueAdmin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },

        select: {
          id: true,
        },
      });

    return Boolean(
      leagueAdmin,
    );
  }

  async isLeagueOwner(userId: string, leagueId: string) {
    if (await this.isSuperAdmin(userId)) return true;
    const owner = await this.prisma.leagueAdmin.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { role: true },
    });
    return owner?.role === 'OWNER';
  }

  async canManageLeagueAdmins(userId: string, leagueId: string) {
    return this.isLeagueOwner(userId, leagueId);
  }

  async canManageTournamentAdmins(userId: string, tournamentId: string) {
    if (await this.isSuperAdmin(userId)) return true;
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { createdByUserId: true },
    });
    return Boolean(tournament && tournament.createdByUserId === userId);
  }

  async hasLeaguePermission(userId: string, leagueId: string, permission: LeagueAdminPermissionName) {
    if (await this.isSuperAdmin(userId)) return true;
    const admin = await this.prisma.leagueAdmin.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { role: true, permissions: true },
    });
    if (!admin) return false;
    return admin.role === 'OWNER' || (admin.permissions as string[]).includes(permission);
  }

  async assertLeaguePermission(userId: string, leagueId: string, permission: LeagueAdminPermissionName) {
    if (!(await this.hasLeaguePermission(userId, leagueId, permission))) {
      throw this.permissionDenied(`${permission.replaceAll('_', ' ')} permission is required.`);
    }
  }

  async hasTournamentPermission(userId: string, tournamentId: string, permission: TournamentAdminPermissionName) {
    if (await this.isSuperAdmin(userId)) return true;
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { createdByUserId: true },
    });
    if (tournament?.createdByUserId === userId) return true;
    const admin = await this.prisma.tournamentAdmin.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
      select: { role: true, permissions: true },
    });
    if (admin && (admin.role === 'OWNER' || (admin.permissions as string[]).includes(permission))) return true;

    return this.hasLegacyTournamentAdmin(userId, tournamentId);
  }

  async canManageTournamentPermission(userId: string, tournamentId: string, permission: TournamentAdminPermissionName) {
    return this.hasTournamentPermission(userId, tournamentId, permission);
  }

  async assertCanManageTournamentPermission(userId: string, tournamentId: string, permission: TournamentAdminPermissionName) {
    if (!(await this.canManageTournamentPermission(userId, tournamentId, permission))) {
      throw this.permissionDenied(`${permission.replaceAll('_', ' ')} permission is required.`);
    }
  }

  async hasScopedRole(
    userId: string,
    role: ScopedRoleName,
    scopeType:
      | 'GLOBAL'
      | 'LEAGUE'
      | 'TOURNAMENT',
    scopeId: string,
  ) {
    if (
      await this.isSuperAdmin(
        userId,
      )
    ) {
      return true;
    }

    const assignment =
      await this.prisma.roleAssignment.findUnique({
        where: {
          userId_role_scopeType_scopeId: {
            userId,
            role,
            scopeType,
            scopeId,
          },
        },

        select: {
          id: true,
        },
      });

    return Boolean(
      assignment,
    );
  }

  async canManageTournament(
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
          createdByUserId: true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    if (
      tournament.createdByUserId ===
      userId
    ) {
      return true;
    }

    if (
      await this.hasScopedRole(
        userId,
        'TOURNAMENT_ADMIN',
        'TOURNAMENT',
        tournament.id,
      )
    ) {
      return true;
    }

    const tournamentAdmin = await this.prisma.tournamentAdmin.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
      select: { role: true, permissions: true },
    });
    if (tournamentAdmin && (tournamentAdmin.role === 'OWNER' || (tournamentAdmin.permissions as string[]).some((permission) => [
      'MANAGE_FIXTURES',
      'MANAGE_RESULTS',
      'VERIFY_SCORES',
      'MANAGE_PARTICIPANTS',
      'MANAGE_SETTINGS',
    ].includes(permission)))) {
      return true;
    }

    return this.hasScopedRole(
      userId,
      'TOURNAMENT_ADMIN',
      'LEAGUE',
      tournament.leagueId,
    );
  }

  async canManageFixtures(
    userId: string,
    tournamentId: string,
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

    if (await this.hasTournamentPermission(userId, tournamentId, 'MANAGE_FIXTURES')) return true;

    if (
      await this.hasScopedRole(
        userId,
        'MATCH_OFFICIAL',
        'TOURNAMENT',
        tournamentId,
      )
    ) {
      return true;
    }

    return this.hasScopedRole(
      userId,
      'MATCH_OFFICIAL',
      'LEAGUE',
      tournament.leagueId,
    );
  }

  async canVerifyResult(
    userId: string,
    matchId: string,
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: {
          id: matchId,
        },

        select: {
          tournamentId: true,

          tournament: {
            select: {
              leagueId: true,
            },
          },
        },
      });

    if (!match) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'MATCH_NOT_FOUND',

          message:
            'Match could not be found.',
        },
      });
    }

    if (await this.hasTournamentPermission(userId, match.tournamentId, 'VERIFY_SCORES')) return true;

    if (
      await this.hasScopedRole(
        userId,
        'MATCH_OFFICIAL',
        'TOURNAMENT',
        match.tournamentId,
      )
    ) {
      return true;
    }

    return this.hasScopedRole(
      userId,
      'MATCH_OFFICIAL',
      'LEAGUE',
      match.tournament.leagueId,
    );
  }

  async assertLeagueAdmin(
    userId: string,
    leagueId: string,
  ) {
    const allowed =
      await this.isLeagueAdmin(
        userId,
        leagueId,
      );

    if (!allowed) {
      throw this.permissionDenied(
        'League Admin permission is required.',
      );
    }
  }

  async assertCanManageTournament(
    userId: string,
    tournamentId: string,
  ) {
    const allowed =
      await this.canManageTournament(
        userId,
        tournamentId,
      );

    if (!allowed) {
      throw this.permissionDenied(
        'Tournament Admin permission is required.',
      );
    }
  }

  async assertCanManageFixtures(
    userId: string,
    tournamentId: string,
  ) {
    const allowed =
      await this.canManageFixtures(
        userId,
        tournamentId,
      );

    if (!allowed) {
      throw this.permissionDenied(
        'Fixture management permission is required.',
      );
    }
  }

  async assertCanVerifyResult(
    userId: string,
    matchId: string,
  ) {
    const allowed =
      await this.canVerifyResult(
        userId,
        matchId,
      );

    if (!allowed) {
      throw this.permissionDenied(
        'Result verification permission is required.',
      );
    }
  }

  async getEffectiveAccess(
    userId: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          role: true,

          leagueAdminRoles: {
            select: {
              leagueId: true,
              role: true,
              permissions: true,
            },
          },

          tournamentAdminRoles: {
            select: {
              tournamentId: true,
              role: true,
              permissions: true,
            },
          },

          roleAssignments: {
            select: {
              id: true,
              role: true,
              scopeType: true,
              scopeId: true,
              createdAt: true,
            },

            orderBy: {
              createdAt:
                'asc',
            },
          },
        },
      });

    if (!user) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'USER_NOT_FOUND',

          message:
            'User could not be found.',
        },
      });
    }

    return {
      globalRole:
        user.role,

      leagueRoles:
        user.leagueAdminRoles,

      tournamentRoles:
        user.tournamentAdminRoles,

      scopedRoles:
        user.roleAssignments,
    };
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

  private async hasLegacyTournamentAdmin(userId: string, tournamentId: string) {
    if (await this.hasScopedRole(userId, 'TOURNAMENT_ADMIN', 'TOURNAMENT', tournamentId)) return true;
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId }, select: { leagueId: true } });
    return Boolean(tournament && await this.hasScopedRole(userId, 'TOURNAMENT_ADMIN', 'LEAGUE', tournament.leagueId));
  }

  private permissionDenied(
    message: string,
  ) {
    return new ForbiddenException({
      success: false,
      data: null,

      error: {
        code:
          'PERMISSION_DENIED',

        message,
      },
    });
  }
}
