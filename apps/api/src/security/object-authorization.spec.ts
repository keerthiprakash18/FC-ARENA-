import { describe, expect, it, vi } from 'vitest';
import { AuthorizationService } from './authorization.service.js';

describe('Cross-object authorization', () => {
  function fixture() {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ role: 'PLAYER' }) },
      leagueAdmin: { findUnique: vi.fn(async ({ where }) => where.leagueId_userId.leagueId === 'own-league' ? { id: 'assignment' } : null) },
      roleAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
      tournament: { findUnique: vi.fn().mockResolvedValue({ id: 'other-tournament', leagueId: 'other-league', createdByUserId: 'other-user' }) },
    };
    return { prisma, service: new AuthorizationService(prisma as never) };
  }
  it('does not let an admin of one league manage another league tournament', async () => {
    const f = fixture();
    await expect(f.service.assertCanManageTournament('league-admin', 'other-tournament')).rejects.toMatchObject({ status: 403 });
    expect(f.prisma.leagueAdmin.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { leagueId_userId: { userId: 'league-admin', leagueId: 'other-league' } } }));
  });
  it('does not promote team-manager access to tournament-admin access', async () => {
    const f = fixture();
    f.prisma.roleAssignment.findUnique.mockImplementation(async ({ where }) => where.userId_role_scopeType_scopeId.role === 'TEAM_MANAGER' ? { id: 'team-role' } : null);
    await expect(f.service.assertCanManageTournament('team-manager', 'other-tournament')).rejects.toMatchObject({ status: 403 });
  });
});
