import { describe, expect, it, vi } from 'vitest';
import { AdminManagementService } from './admin-management.service.js';

function adminUser(id = 'user-2') {
  return {
    id,
    fullName: 'Admin User',
    status: 'ACTIVE',
    role: 'USER',
    player: { profileImageUrl: null, identity: { inGameName: 'admin-user' } },
  };
}

describe('AdminManagementService', () => {
  it('assigns multiple league admins with unique assignments and configurable capacity', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(adminUser()) },
      league: { findUnique: vi.fn().mockResolvedValue({ id: 'league-1', maxAdmins: 2 }) },
      leagueAdmin: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(({ data, _include }) => ({ ...data, id: 'admin-1', createdAt: new Date(), user: adminUser(data.userId) })),
      },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', role: 'USER' }) },
      $transactionWithRetry: vi.fn(async (work: any) => work(tx)),
    };
    const authorization = {
      canManageLeagueAdmins: vi.fn().mockResolvedValue(true),
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };
    const service = new AdminManagementService(prisma as never, authorization as never);

    await expect(service.addAdmin('owner-1', 'LEAGUE', 'league-1', { userId: 'user-2' })).resolves.toMatchObject({ success: true });
    await expect(service.addAdmin('owner-1', 'LEAGUE', 'league-1', { userId: 'user-3' })).resolves.toMatchObject({ success: true });
    expect(tx.leagueAdmin.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it('rejects duplicate assignments before writing', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(adminUser()) },
      league: { findUnique: vi.fn().mockResolvedValue({ id: 'league-1', maxAdmins: null }) },
      leagueAdmin: { findUnique: vi.fn().mockResolvedValue({ id: 'existing' }), count: vi.fn(), create: vi.fn() },
    };
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', role: 'USER' }) }, $transactionWithRetry: vi.fn(async (work: any) => work(tx)) };
    const authorization = { canManageLeagueAdmins: vi.fn().mockResolvedValue(true), isSuperAdmin: vi.fn().mockResolvedValue(false) };
    const service = new AdminManagementService(prisma as never, authorization as never);

    await expect(service.addAdmin('owner-1', 'LEAGUE', 'league-1', { userId: 'user-2' })).rejects.toMatchObject({ status: 409 });
    expect(tx.leagueAdmin.create).not.toHaveBeenCalled();
  });

  it('rejects unauthorized API callers and protects the owner', async () => {
    const tx = {
      leagueAdmin: {
        findUnique: vi.fn().mockResolvedValue({ id: 'owner-admin', role: 'OWNER', userId: 'owner-1', permissions: [] }),
        delete: vi.fn(),
      },
    };
    const prisma = { user: { findUnique: vi.fn() }, $transactionWithRetry: vi.fn(async (work: any) => work(tx)) };
    const authorization = { canManageLeagueAdmins: vi.fn().mockResolvedValue(false), isSuperAdmin: vi.fn().mockResolvedValue(false) };
    const service = new AdminManagementService(prisma as never, authorization as never);

    await expect(service.removeAdmin('regular-user', 'LEAGUE', 'league-1', 'owner-admin')).rejects.toMatchObject({ status: 403 });
    expect(prisma.$transactionWithRetry).not.toHaveBeenCalled();

    authorization.canManageLeagueAdmins.mockResolvedValue(true);
    await expect(service.removeAdmin('owner-1', 'LEAGUE', 'league-1', 'owner-admin')).rejects.toMatchObject({ status: 400 });
    expect(tx.leagueAdmin.delete).not.toHaveBeenCalled();
  });

  it('replaces an admin atomically while preserving the assigned permissions', async () => {
    const current = { id: 'admin-1', role: 'ADMIN', userId: 'outgoing', permissions: ['MANAGE_MEMBERS'] };
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'incoming', status: 'ACTIVE', role: 'USER' }) },
      leagueAdmin: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValueOnce(null),
        update: vi.fn().mockResolvedValue({ ...current, userId: 'incoming', user: adminUser('incoming') }),
      },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', role: 'USER' }) },
      $transactionWithRetry: vi.fn(async (work: any) => work(tx)),
    };
    const authorization = { canManageLeagueAdmins: vi.fn().mockResolvedValue(true), isSuperAdmin: vi.fn().mockResolvedValue(false) };
    const service = new AdminManagementService(prisma as never, authorization as never);

    await expect(service.replaceAdmin('owner-1', 'LEAGUE', 'league-1', 'admin-1', { replacementUserId: 'incoming' })).resolves.toMatchObject({ data: { admin: { userId: 'incoming', permissions: ['MANAGE_MEMBERS'] } } });
    expect(tx.leagueAdmin.update).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: 'incoming' } }));
    expect(prisma.$transactionWithRetry).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
});
