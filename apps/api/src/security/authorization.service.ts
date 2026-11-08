import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

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
      select: { createdByUserId: true, leagueId: true },
    });
    return Boolean(tournament && (tournament.createdByUserId === userId || await this.isLeagueOwner(userId, tournament.leagueId)));
  }

  async hasLeaguePermission(userId: string, leagueId: string, permission: LeagueAdminPermissionName) {
    if (await this.isSuperAdmin(userId)) return true;
    const admin = await this.prisma.leagueAdmin.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { role: true, permissions: true },
    });
    if (!admin) return false;
    return admin.role === 'OWNER' || (admin.permissions ?? []).includes(permission);
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
      select: { createdByUserId: true, leagueId: true },
    });
    if (tournament?.createdByUserId === userId) return true;
    if (tournament && await this.isLeagueOwner(userId, tournament.leagueId)) return true;
    // League tournament managers review entries across that league. Other
    // tournament operations still require their own explicit permission.
    if (tournament && permission === 'MANAGE_PARTICIPANTS' &&
      await this.hasLeaguePermission(userId, tournament.leagueId, 'MANAGE_TOURNAMENTS')) return true;
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

    if (await this.hasLeaguePermission(userId, tournament.leagueId, 'MANAGE_TOURNAMENTS')) return true;

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

  /** Matches MANAGE_PARTICIPANTS checks without a permission query per list row. */
  async registrationReviewScope(userId: string): Promise<Prisma.TournamentWhereInput> {
    return (await this.tournamentListScopes(userId)).review;
  }

  async tournamentListScopes(userId: string) {
    const access = await this.getEffectiveAccess(userId);
    return { review: this.permissionScope(access, userId, 'MANAGE_PARTICIPANTS'),
      settings: this.permissionScope(access, userId, 'MANAGE_SETTINGS') };
  }

  private permissionScope(access: Awaited<ReturnType<AuthorizationService['getEffectiveAccess']>>, userId: string,
    permission: TournamentAdminPermissionName): Prisma.TournamentWhereInput {
    if (access.globalRole === 'SUPER_ADMIN') return {};
    const leagueIds = access.leagueRoles.filter(admin => admin.role === 'OWNER' ||
      (permission === 'MANAGE_PARTICIPANTS' && admin.permissions.includes('MANAGE_TOURNAMENTS'))).map(admin => admin.leagueId);
    const tournamentIds = access.tournamentRoles.filter(admin => admin.role === 'OWNER' ||
      admin.permissions.includes(permission)).map(admin => admin.tournamentId);
    for (const role of access.scopedRoles) {
      if (role.role !== 'TOURNAMENT_ADMIN') continue;
      if (role.scopeType === 'LEAGUE') leagueIds.push(role.scopeId);
      if (role.scopeType === 'TOURNAMENT') tournamentIds.push(role.scopeId);
    }
    return { OR: [{ createdByUserId: userId }, { leagueId: { in: leagueIds } }, { id: { in: tournamentIds } }] };
  }

  /** The same scopes accepted by canVerifyResult, applied before queue pagination. */
  async resultVerificationScope(userId: string): Promise<Prisma.TournamentWhereInput> {
    const access = await this.getEffectiveAccess(userId);
    if (access.globalRole === 'SUPER_ADMIN') return {};
    const tournamentIds = access.tournamentRoles.filter(admin =>
      admin.role === 'OWNER' || admin.permissions.includes('VERIFY_SCORES')).map(admin => admin.tournamentId);
    const leagueIds: string[] = access.leagueRoles.filter(role => role.role === 'OWNER').map(role => role.leagueId);
    for (const role of access.scopedRoles) {
      if (role.role !== 'TOURNAMENT_ADMIN' && role.role !== 'MATCH_OFFICIAL') continue;
      if (role.scopeType === 'TOURNAMENT') tournamentIds.push(role.scopeId);
      if (role.scopeType === 'LEAGUE') leagueIds.push(role.scopeId);
    }
    return { OR: [{ createdByUserId: userId }, { id: { in: tournamentIds } }, { leagueId: { in: leagueIds } }] };
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
