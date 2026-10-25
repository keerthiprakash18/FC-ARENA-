import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  LEAGUE_ADMIN_PERMISSIONS,
  TOURNAMENT_ADMIN_PERMISSIONS,
} from './dto/assign-resource-admin.dto.js';
import type { UpdateAdminLimitDto } from './dto/update-admin-limit.dto.js';
import type { ReplaceResourceAdminDto } from './dto/replace-resource-admin.dto.js';
import type { AssignResourceAdminDto } from './dto/assign-resource-admin.dto.js';
import type { UpdateResourceAdminDto } from './dto/update-resource-admin.dto.js';
import { AuthorizationService } from './authorization.service.js';

type ScopeType = 'LEAGUE' | 'TOURNAMENT';

const leagueDefaultPermissions = [...LEAGUE_ADMIN_PERMISSIONS];
const tournamentDefaultPermissions = [...TOURNAMENT_ADMIN_PERMISSIONS];

@Injectable()
export class AdminManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async listAdmins(actorUserId: string, scopeType: ScopeType, scopeId: string) {
    await this.assertCanManageAdmins(actorUserId, scopeType, scopeId);

    if (scopeType === 'LEAGUE') {
      const league = await this.prisma.league.findUnique({
        where: { id: scopeId },
        select: {
          id: true,
          maxAdmins: true,
          admins: {
            orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  status: true,
                  player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } },
                },
              },
            },
          },
        },
      });

      if (!league) throw this.notFound('LEAGUE_NOT_FOUND', 'League could not be found.');

      return {
        success: true,
        data: {
          scopeType,
          scopeId,
          maxAdmins: league.maxAdmins,
          admins: league.admins.map((admin) => this.serializeAdmin(admin)),
        },
        error: null,
      };
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: scopeId },
      select: {
        id: true,
        maxAdmins: true,
        admins: {
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                status: true,
                player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } },
              },
            },
          },
        },
      },
    });

    if (!tournament) throw this.notFound('TOURNAMENT_NOT_FOUND', 'Tournament could not be found.');

    return {
      success: true,
      data: {
        scopeType,
        scopeId,
        maxAdmins: tournament.maxAdmins,
        admins: tournament.admins.map((admin) => this.serializeAdmin(admin)),
      },
      error: null,
    };
  }

  async listCandidates(actorUserId: string, scopeType: ScopeType, scopeId: string, search?: string) {
    await this.assertCanManageAdmins(actorUserId, scopeType, scopeId);
    const normalizedSearch = search?.trim();
    const actorIsSuperAdmin = await this.authorization.isSuperAdmin(actorUserId);

    const users: any[] = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(actorIsSuperAdmin ? {} : { role: { not: 'SUPER_ADMIN' } }),
        ...(normalizedSearch
          ? {
              OR: [
                { fullName: { contains: normalizedSearch, mode: 'insensitive' } },
                { player: { is: { identity: { is: { inGameName: { contains: normalizedSearch, mode: 'insensitive' } } } } } },
                { player: { is: { playerCode: { contains: normalizedSearch, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      orderBy: { fullName: 'asc' },
      take: 50,
      select: {
        id: true,
        fullName: true,
        player: { select: { profileImageUrl: true, playerCode: true, identity: { select: { inGameName: true } } } },
        ...(scopeType === 'LEAGUE'
          ? { leagueAdminRoles: { where: { leagueId: scopeId }, select: { role: true } } }
          : { tournamentAdminRoles: { where: { tournamentId: scopeId }, select: { role: true } } }),
      },
    });

    return {
      success: true,
      data: {
        users: users.map((user) => ({
          id: user.id,
          username: user.player?.identity?.inGameName ?? user.fullName,
          fullName: user.fullName,
          profileImageUrl: user.player?.profileImageUrl ?? null,
          playerCode: user.player?.playerCode ?? null,
          assigned: Boolean(
            scopeType === 'LEAGUE'
              ? user.leagueAdminRoles?.length
              : user.tournamentAdminRoles?.length,
          ),
        })),
      },
      error: null,
    };
  }

  async addAdmin(actorUserId: string, scopeType: ScopeType, scopeId: string, dto: AssignResourceAdminDto) {
    await this.assertCanManageAdmins(actorUserId, scopeType, scopeId);
    await this.assertAssignableUser(actorUserId, dto.userId);

    try {
      const admin = await this.prisma.$transactionWithRetry(async (tx) => {
        const target = await tx.user.findUnique({ where: { id: dto.userId }, select: { id: true, fullName: true, status: true } });
        if (!target || target.status !== 'ACTIVE') throw this.notFound('USER_NOT_FOUND', 'Target user could not be found.');

        if (scopeType === 'LEAGUE') {
          const league = await tx.league.findUnique({ where: { id: scopeId }, select: { id: true, maxAdmins: true } });
          if (!league) throw this.notFound('LEAGUE_NOT_FOUND', 'League could not be found.');
          const existing = await tx.leagueAdmin.findUnique({ where: { leagueId_userId: { leagueId: scopeId, userId: dto.userId } } });
          if (existing) throw this.conflict('ADMIN_ALREADY_ASSIGNED', 'This user is already a League admin.');
          await this.assertAdminCapacity(tx, 'LEAGUE', scopeId, league.maxAdmins);

          const created = await tx.leagueAdmin.create({
            data: {
              leagueId: scopeId,
              userId: dto.userId,
              role: 'ADMIN',
              permissions: (dto.leaguePermissions ?? leagueDefaultPermissions) as any,
            },
            include: { user: { select: { id: true, fullName: true, status: true, player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } } } } },
          });
          await this.writeAudit(tx, actorUserId, 'LEAGUE_ADMIN_ASSIGNED', 'LeagueAdmin', created.id, 'LEAGUE', scopeId, null, { userId: dto.userId, role: created.role, permissions: created.permissions });
          return created;
        }

        const tournament = await tx.tournament.findUnique({ where: { id: scopeId }, select: { id: true, maxAdmins: true } });
        if (!tournament) throw this.notFound('TOURNAMENT_NOT_FOUND', 'Tournament could not be found.');
        const existing = await tx.tournamentAdmin.findUnique({ where: { tournamentId_userId: { tournamentId: scopeId, userId: dto.userId } } });
        if (existing) throw this.conflict('ADMIN_ALREADY_ASSIGNED', 'This user is already a Tournament admin.');
        await this.assertAdminCapacity(tx, 'TOURNAMENT', scopeId, tournament.maxAdmins);

        const created = await tx.tournamentAdmin.create({
          data: {
            tournamentId: scopeId,
            userId: dto.userId,
            role: 'ADMIN',
            permissions: (dto.tournamentPermissions ?? tournamentDefaultPermissions) as any,
          },
          include: { user: { select: { id: true, fullName: true, status: true, player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } } } } },
        });
        await this.writeAudit(tx, actorUserId, 'TOURNAMENT_ADMIN_ASSIGNED', 'TournamentAdmin', created.id, 'TOURNAMENT', scopeId, null, { userId: dto.userId, role: created.role, permissions: created.permissions });
        return created;
      }, { isolationLevel: 'Serializable' });

      return { success: true, data: { message: 'Admin assigned successfully.', admin: this.serializeAdmin(admin) }, error: null };
    } catch (error) {
      if (this.isUniqueConflict(error)) throw this.conflict('ADMIN_ALREADY_ASSIGNED', 'This user is already assigned as an admin.');
      throw error;
    }
  }

  async updateAdmin(actorUserId: string, scopeType: ScopeType, scopeId: string, adminId: string, dto: UpdateResourceAdminDto) {
    await this.assertCanManageAdmins(actorUserId, scopeType, scopeId);
    const permissions = scopeType === 'LEAGUE' ? dto.leaguePermissions : dto.tournamentPermissions;
    if (permissions === undefined) throw new BadRequestException({ success: false, data: null, error: { code: 'PERMISSIONS_REQUIRED', message: 'Provide the permissions to save.' } });

    const result = await this.prisma.$transactionWithRetry(async (tx) => {
      if (scopeType === 'LEAGUE') {
        const current = await tx.leagueAdmin.findUnique({ where: { id: adminId, leagueId: scopeId }, include: { user: { select: { id: true, fullName: true, status: true, player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } } } } } });
        if (!current) throw this.notFound('ADMIN_NOT_FOUND', 'League admin could not be found.');
        if (current.role === 'OWNER') throw this.protectedOwner();
        const updated = await tx.leagueAdmin.update({ where: { id: adminId }, data: { permissions: permissions as any }, include: { user: { select: { id: true, fullName: true, status: true, player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } } } } } });
        await this.writeAudit(tx, actorUserId, 'LEAGUE_ADMIN_PERMISSIONS_UPDATED', 'LeagueAdmin', adminId, 'LEAGUE', scopeId, { userId: current.userId, permissions: current.permissions }, { userId: updated.userId, permissions: updated.permissions });
        return updated;
      }

      const current = await tx.tournamentAdmin.findUnique({ where: { id: adminId, tournamentId: scopeId }, include: { user: { select: { id: true, fullName: true, status: true, player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } } } } } });
      if (!current) throw this.notFound('ADMIN_NOT_FOUND', 'Tournament admin could not be found.');
      if (current.role === 'OWNER') throw this.protectedOwner();
      const updated = await tx.tournamentAdmin.update({ where: { id: adminId }, data: { permissions: permissions as any }, include: { user: { select: { id: true, fullName: true, status: true, player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } } } } } });
      await this.writeAudit(tx, actorUserId, 'TOURNAMENT_ADMIN_PERMISSIONS_UPDATED', 'TournamentAdmin', adminId, 'TOURNAMENT', scopeId, { userId: current.userId, permissions: current.permissions }, { userId: updated.userId, permissions: updated.permissions });
      return updated;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: { message: 'Admin permissions updated.', admin: this.serializeAdmin(result) }, error: null };
  }

  async removeAdmin(actorUserId: string, scopeType: ScopeType, scopeId: string, adminId: string) {
    await this.assertCanManageAdmins(actorUserId, scopeType, scopeId);
    await this.prisma.$transactionWithRetry(async (tx) => {
      if (scopeType === 'LEAGUE') {
        const current = await tx.leagueAdmin.findUnique({ where: { id: adminId, leagueId: scopeId } });
        if (!current) throw this.notFound('ADMIN_NOT_FOUND', 'League admin could not be found.');
        if (current.role === 'OWNER') throw this.protectedOwner();
        await tx.leagueAdmin.delete({ where: { id: adminId } });
        await this.writeAudit(tx, actorUserId, 'LEAGUE_ADMIN_REMOVED', 'LeagueAdmin', adminId, 'LEAGUE', scopeId, { userId: current.userId, role: current.role, permissions: current.permissions }, null);
        return;
      }

      const current = await tx.tournamentAdmin.findUnique({ where: { id: adminId, tournamentId: scopeId } });
      if (!current) throw this.notFound('ADMIN_NOT_FOUND', 'Tournament admin could not be found.');
      if (current.role === 'OWNER') throw this.protectedOwner();
      await tx.tournamentAdmin.delete({ where: { id: adminId } });
      await this.writeAudit(tx, actorUserId, 'TOURNAMENT_ADMIN_REMOVED', 'TournamentAdmin', adminId, 'TOURNAMENT', scopeId, { userId: current.userId, role: current.role, permissions: current.permissions }, null);
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: { message: 'Admin removed successfully.' }, error: null };
  }

  async replaceAdmin(actorUserId: string, scopeType: ScopeType, scopeId: string, adminId: string, dto: ReplaceResourceAdminDto) {
    await this.assertCanManageAdmins(actorUserId, scopeType, scopeId);
    if (dto.transferOwnership) throw new BadRequestException({ success: false, data: null, error: { code: 'OWNERSHIP_TRANSFER_REQUIRED', message: 'Ownership transfer is a separate protected action and is not performed by replacement.' } });
    await this.assertAssignableUser(actorUserId, dto.replacementUserId);

    try {
      const result = await this.prisma.$transactionWithRetry(async (tx) => {
        const replacement = await tx.user.findUnique({ where: { id: dto.replacementUserId }, select: { id: true, status: true } });
        if (!replacement || replacement.status !== 'ACTIVE') throw this.notFound('USER_NOT_FOUND', 'Replacement user could not be found.');

        if (scopeType === 'LEAGUE') {
          const current = await tx.leagueAdmin.findUnique({ where: { id: adminId, leagueId: scopeId } });
          if (!current) throw this.notFound('ADMIN_NOT_FOUND', 'League admin could not be found.');
          if (current.role === 'OWNER') throw this.protectedOwner();
          const alreadyAssigned = await tx.leagueAdmin.findUnique({ where: { leagueId_userId: { leagueId: scopeId, userId: dto.replacementUserId } } });
          if (alreadyAssigned) throw this.conflict('ADMIN_ALREADY_ASSIGNED', 'The replacement user is already a League admin.');
          const updated = await tx.leagueAdmin.update({ where: { id: adminId }, data: { userId: dto.replacementUserId }, include: { user: { select: { id: true, fullName: true, status: true, player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } } } } } });
          await this.writeAudit(tx, actorUserId, 'LEAGUE_ADMIN_REPLACED', 'LeagueAdmin', adminId, 'LEAGUE', scopeId, { outgoingUserId: current.userId, role: current.role, permissions: current.permissions }, { incomingUserId: dto.replacementUserId, role: updated.role, permissions: updated.permissions });
          return updated;
        }

        const current = await tx.tournamentAdmin.findUnique({ where: { id: adminId, tournamentId: scopeId } });
        if (!current) throw this.notFound('ADMIN_NOT_FOUND', 'Tournament admin could not be found.');
        if (current.role === 'OWNER') throw this.protectedOwner();
        const alreadyAssigned = await tx.tournamentAdmin.findUnique({ where: { tournamentId_userId: { tournamentId: scopeId, userId: dto.replacementUserId } } });
        if (alreadyAssigned) throw this.conflict('ADMIN_ALREADY_ASSIGNED', 'The replacement user is already a Tournament admin.');
        const updated = await tx.tournamentAdmin.update({ where: { id: adminId }, data: { userId: dto.replacementUserId }, include: { user: { select: { id: true, fullName: true, status: true, player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } } } } } });
        await this.writeAudit(tx, actorUserId, 'TOURNAMENT_ADMIN_REPLACED', 'TournamentAdmin', adminId, 'TOURNAMENT', scopeId, { outgoingUserId: current.userId, role: current.role, permissions: current.permissions }, { incomingUserId: dto.replacementUserId, role: updated.role, permissions: updated.permissions });
        return updated;
      }, { isolationLevel: 'Serializable' });

      return { success: true, data: { message: 'Admin replaced successfully.', admin: this.serializeAdmin(result) }, error: null };
    } catch (error) {
      if (this.isUniqueConflict(error)) throw this.conflict('ADMIN_ALREADY_ASSIGNED', 'The replacement user is already assigned as an admin.');
      throw error;
    }
  }

  async updateLimit(actorUserId: string, scopeType: ScopeType, scopeId: string, dto: UpdateAdminLimitDto) {
    await this.assertCanManageAdmins(actorUserId, scopeType, scopeId);
    const maxAdmins = dto.maxAdmins ?? null;
    const updated = await this.prisma.$transactionWithRetry(async (tx) => {
      if (scopeType === 'LEAGUE') {
        const league = await tx.league.findUnique({ where: { id: scopeId }, select: { id: true, maxAdmins: true } });
        if (!league) throw this.notFound('LEAGUE_NOT_FOUND', 'League could not be found.');
        await this.assertAdminLimitAllowsExisting(tx, scopeType, scopeId, maxAdmins);
        const value = await tx.league.update({ where: { id: scopeId }, data: { maxAdmins }, select: { maxAdmins: true } });
        await this.writeAudit(tx, actorUserId, 'LEAGUE_ADMIN_LIMIT_UPDATED', 'League', scopeId, 'LEAGUE', scopeId, { maxAdmins: league.maxAdmins }, { maxAdmins: value.maxAdmins });
        return value;
      }

      const tournament = await tx.tournament.findUnique({ where: { id: scopeId }, select: { id: true, maxAdmins: true } });
      if (!tournament) throw this.notFound('TOURNAMENT_NOT_FOUND', 'Tournament could not be found.');
      await this.assertAdminLimitAllowsExisting(tx, scopeType, scopeId, maxAdmins);
      const value = await tx.tournament.update({ where: { id: scopeId }, data: { maxAdmins }, select: { maxAdmins: true } });
      await this.writeAudit(tx, actorUserId, 'TOURNAMENT_ADMIN_LIMIT_UPDATED', 'Tournament', scopeId, 'TOURNAMENT', scopeId, { maxAdmins: tournament.maxAdmins }, { maxAdmins: value.maxAdmins });
      return value;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: { message: maxAdmins === null ? 'Admin limit removed. Additional admins are unlimited.' : 'Admin limit updated.', maxAdmins: updated.maxAdmins }, error: null };
  }

  private async assertCanManageAdmins(actorUserId: string, scopeType: ScopeType, scopeId: string) {
    const allowed = scopeType === 'LEAGUE'
      ? await this.authorization.canManageLeagueAdmins(actorUserId, scopeId)
      : await this.authorization.canManageTournamentAdmins(actorUserId, scopeId);
    if (!allowed) throw new ForbiddenException({ success: false, data: null, error: { code: 'ADMIN_MANAGEMENT_FORBIDDEN', message: 'Only the owner or a platform Super Admin can manage administrators.' } });
  }

  private async assertAssignableUser(actorUserId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true, role: true } });
    if (!user || user.status !== 'ACTIVE') throw this.notFound('USER_NOT_FOUND', 'User could not be found.');
    if (user.role === 'SUPER_ADMIN' && !(await this.authorization.isSuperAdmin(actorUserId))) throw this.protectedPlatformAdmin();
  }

  private async assertAdminCapacity(tx: any, scopeType: ScopeType, scopeId: string, maxAdmins: number | null) {
    if (maxAdmins === null) return;
    const count = scopeType === 'LEAGUE'
      ? await tx.leagueAdmin.count({ where: { leagueId: scopeId, role: 'ADMIN' } })
      : await tx.tournamentAdmin.count({ where: { tournamentId: scopeId, role: 'ADMIN' } });
    if (count >= maxAdmins) throw this.conflict('ADMIN_LIMIT_REACHED', 'The configured administrator limit has been reached.');
  }

  private async assertAdminLimitAllowsExisting(tx: any, scopeType: ScopeType, scopeId: string, maxAdmins: number | null) {
    if (maxAdmins === null) return;
    const count = scopeType === 'LEAGUE'
      ? await tx.leagueAdmin.count({ where: { leagueId: scopeId, role: 'ADMIN' } })
      : await tx.tournamentAdmin.count({ where: { tournamentId: scopeId, role: 'ADMIN' } });
    if (count > maxAdmins) throw this.conflict('ADMIN_LIMIT_BELOW_CURRENT_COUNT', 'The configured administrator limit cannot be lower than the current number of admins.');
  }

  private serializeAdmin(admin: any) {
    const user = admin.user;
    return {
      id: admin.id,
      userId: user.id,
      username: user.player?.identity?.inGameName ?? user.fullName,
      fullName: user.fullName,
      profileImageUrl: user.player?.profileImageUrl ?? null,
      role: admin.role,
      permissions: admin.permissions,
      status: user.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      assignedAt: admin.createdAt,
    };
  }

  private async writeAudit(tx: any, actorUserId: string, action: string, targetType: string, targetId: string, scopeType: ScopeType, scopeId: string, beforeData: unknown, afterData: unknown) {
    await tx.auditLog.create({ data: { actorUserId, action, targetType, targetId, scopeType, scopeId, beforeData: beforeData as any, afterData: afterData as any } });
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private conflict(code: string, message: string) {
    return new ConflictException({ success: false, data: null, error: { code, message } });
  }

  private notFound(code: string, message: string) {
    return new NotFoundException({ success: false, data: null, error: { code, message } });
  }

  private protectedOwner() {
    return new BadRequestException({ success: false, data: null, error: { code: 'OWNER_PROTECTED', message: 'The owner cannot be removed, demoted, or replaced by an admin operation.' } });
  }

  private protectedPlatformAdmin() {
    return new ForbiddenException({ success: false, data: null, error: { code: 'PLATFORM_ADMIN_PROTECTED', message: 'Platform Super Admin accounts can only be managed by another platform Super Admin.' } });
  }
}
