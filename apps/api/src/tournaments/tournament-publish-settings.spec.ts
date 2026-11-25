import { describe, expect, it, vi } from 'vitest';
import { TournamentWizardFinalizeService } from './tournament-wizard-finalize.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { AuthorizationService } from '../security/authorization.service.js';

const original = {
  id: 'cup', status: 'DRAFT', competitionFormat: 'LEAGUE_ROUND_ROBIN',
  groupMode: 'SINGLE_TABLE', legType: 'SINGLE_LEG', fixtureMode: 'AUTO',
  playoffSource: 'AUTO', playoffFormat: 'PROTECTED_SEED',
  qualifiersPerGroup: null, playoffQualifiersTotal: 8,
  playoffPairingMethod: 'GLOBAL_SEEDED', playoffSeedingBasis: 'OVERALL_PERFORMANCE',
  avoidSameGroupEarly: false,
};
function setup(change: Partial<typeof original> = {}) {
  const entries = [{ id: 'a', groupId: null, sortOrder: 0, createdAt: new Date(0) },
    { id: 'b', groupId: null, sortOrder: 1, createdAt: new Date(1) }];
  const tx = {
    tournament: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...original, ...change }),
      update: vi.fn().mockResolvedValue({ ...original, status: 'ACTIVE' }),
    },
    tournamentGroup: { findMany: vi.fn().mockResolvedValue([]) },
    tournamentRegistration: { findMany: vi.fn().mockResolvedValue(entries) },
    fixture: { count: vi.fn().mockResolvedValue(1) },
  };
  const db = {
    ...tx,
    tournament: { findUnique: vi.fn().mockResolvedValue(original) },
    $transactionWithRetry: vi.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const auth = { assertCanManageTournamentPermission: vi.fn().mockResolvedValue(undefined) };
  return { tx, db, auth, service: new TournamentWizardFinalizeService(db as unknown as PrismaService, auth as unknown as AuthorizationService) };
}
describe('tournament publication compares all reviewed playoff settings', () => {
  it.each([
    { playoffPairingMethod: 'CHANGED_PAIRING' },
    { playoffSeedingBasis: 'CHANGED_SEEDING' },
    { avoidSameGroupEarly: true },
  ])('fails closed if settings change during publication: %j', async change => {
    const { service, tx } = setup(change);
    await expect(service.publishTournament('admin', 'cup')).rejects.toMatchObject({
      status: 409, response: { error: { code: 'FIXTURE_INPUTS_CHANGED' } },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });
  it('publishes unchanged inputs without changing rules or fixtures', async () => {
    const { service, tx, auth, db } = setup();
    await expect(service.publishTournament('admin', 'cup')).resolves.toMatchObject({ success: true });
    expect(auth.assertCanManageTournamentPermission).toHaveBeenCalledWith('admin', 'cup', 'MANAGE_SETTINGS');
    expect(db.$transactionWithRetry).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 'cup' }, data: { status: 'ACTIVE', publishedAt: expect.any(Date), wizardStep: 'PUBLISHED' },
    });
  });
});
