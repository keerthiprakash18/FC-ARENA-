import { describe, expect, it, vi } from 'vitest';
import { RoleManagementService } from './role-management.service.js';

describe('Role management mutation authorization', () => {
  function fixture(superAdmin = false) {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'target', fullName: 'Target' }) },
      roleAssignment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'assignment', scopeType: 'LEAGUE', scopeId: 'other-league', user: { id: 'target' } }),
        create: vi.fn(), delete: vi.fn(),
      },
    };
    const authorization = {
      isSuperAdmin: vi.fn().mockResolvedValue(superAdmin),
      isLeagueAdmin: vi.fn().mockResolvedValue(false),
      canManageTournament: vi.fn().mockResolvedValue(false),
    };
    const record = vi.fn();
    return { prisma, record, service: new RoleManagementService(prisma as never, authorization as never, { record } as never) };
  }
  for (const scopeType of ['GLOBAL', 'LEAGUE', 'TOURNAMENT'] as const) {
    it(`rejects unauthorized ${scopeType} role assignments before writing`, async () => {
      const f = fixture();
      await expect(f.service.assignRole('player', { userId: 'target', role: 'TOURNAMENT_ADMIN', scopeType, scopeId: 'other-scope' })).rejects.toMatchObject({ status: 403 });
      expect(f.prisma.roleAssignment.create).not.toHaveBeenCalled();
      expect(f.record).not.toHaveBeenCalled();
    });
  }
  it('rejects cross-league assignment deletion before writing', async () => {
    const f = fixture();
    await expect(f.service.removeRole('other-admin', 'assignment')).rejects.toMatchObject({ status: 403 });
    expect(f.prisma.roleAssignment.delete).not.toHaveBeenCalled();
    expect(f.record).not.toHaveBeenCalled();
  });
});
