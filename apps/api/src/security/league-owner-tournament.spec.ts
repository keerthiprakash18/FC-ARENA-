import { describe, expect, it, vi } from 'vitest';
import { AuthorizationService } from './authorization.service.js';

function setup(role = 'OWNER') {
  const prisma: any = {
    user: { findUnique: vi.fn().mockResolvedValue({ role: 'USER' }) },
    leagueAdmin: {
      findUnique: vi.fn(async ({ where }) =>
        where.leagueId_userId.leagueId === 'own-league'
          ? { role, permissions: ['MANAGE_MEMBERS'] }
          : null,
      ),
    },
    tournamentAdmin: { findUnique: vi.fn().mockResolvedValue(null) },
    tournament: {
      findUnique: vi.fn(async ({ where }) => ({
        id: where.id,
        createdByUserId: 'different-creator',
        leagueId: where.id === 'own-cup' ? 'own-league' : 'other-league',
      })),
    },
    roleAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  return { prisma, service: new AuthorizationService(prisma) };
}
describe('League owner tournament inheritance', () => {
  it('allows the current owner even when another admin created the tournament', async () => {
    const { service } = setup();
    expect(await service.canManageTournament('owner', 'own-cup')).toBe(true);
    expect(
      await service.hasTournamentPermission(
        'owner',
        'own-cup',
        'MANAGE_PARTICIPANTS',
      ),
    ).toBe(true);
    expect(
      await service.hasTournamentPermission(
        'owner',
        'own-cup',
        'VERIFY_SCORES',
      ),
    ).toBe(true);
    expect(await service.canManageTournamentAdmins('owner', 'own-cup')).toBe(
      true,
    );
  });
  it('never extends ownership into another league or promotes a limited league admin', async () => {
    const owner = setup().service,
      limited = setup('ADMIN').service;
    expect(await owner.canManageTournament('owner', 'other-cup')).toBe(false);
    expect(
      await owner.hasTournamentPermission(
        'owner',
        'other-cup',
        'MANAGE_PARTICIPANTS',
      ),
    ).toBe(false);
    expect(await owner.canManageTournamentAdmins('owner', 'other-cup')).toBe(
      false,
    );
    expect(
      await limited.hasTournamentPermission(
        'admin',
        'own-cup',
        'MANAGE_PARTICIPANTS',
      ),
    ).toBe(false);
  });
  it('keeps fixture-only assignments separate from registration review', async () => {
    const { service, prisma } = setup('ADMIN');
    prisma.tournamentAdmin.findUnique.mockResolvedValue({
      role: 'ADMIN',
      permissions: ['MANAGE_FIXTURES'],
    });
    expect(await service.canManageTournament('fixture-admin', 'own-cup')).toBe(
      true,
    );
    expect(
      await service.hasTournamentPermission(
        'fixture-admin',
        'own-cup',
        'MANAGE_FIXTURES',
      ),
    ).toBe(true);
    expect(
      await service.hasTournamentPermission(
        'fixture-admin',
        'own-cup',
        'MANAGE_PARTICIPANTS',
      ),
    ).toBe(false);
  });
  it('includes owned leagues in the review queue while retaining scope isolation', async () => {
    const { service } = setup();
    vi.spyOn(service, 'getEffectiveAccess').mockResolvedValue({
      globalRole: 'USER',
      leagueRoles: [{ leagueId: 'own-league', role: 'OWNER', permissions: [] }],
      tournamentRoles: [],
      scopedRoles: [],
    } as any);
    const scope = await service.resultVerificationScope('owner');
    expect(scope).toEqual({
      OR: [
        { createdByUserId: 'owner' },
        { id: { in: [] } },
        { leagueId: { in: ['own-league'] } },
      ],
    });
  });
});
