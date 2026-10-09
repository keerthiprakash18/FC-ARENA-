import { describe, expect, it, vi } from 'vitest';
import { PlayoffsService } from './playoffs.service.js';
import { buildPlayoffSeedPlan } from './playoff-seeding.js';
import { generateKnockoutFixtures } from './fixture-engine.js';

function setup() {
  const groups = [1, 2].map((g) => ({ id: `g${g}`, name: `g${g}`, position: g,
    registrations: Array.from({ length: 6 }, (_, i) => ({ id: `${g}-${i}`, entryName: `${g}-${i}`, standing: { points: 20-i, goalDifference: 0, goalsFor: 0, wins: 0 } })),
  }));
  const plan = buildPlayoffSeedPlan(groups.map((g) => ({ ...g, qualifiers: g.registrations })));
  const old = generateKnockoutFixtures(plan.seedOrder).map((f, i) => ({ ...f, id: `f${i}`, tournamentId: 't', groupId: null, status: 'UNSCHEDULED', scheduledAt: null,
    match: { id: `m${i}`, status: 'UNSCHEDULED', confirmedResultSubmissionId: null, homeReadyAt: null, awayReadyAt: null, _count: { resultSubmissions: 0, statEvents: 0, ocrExtractions: 0, disputes: 0 } },
  }));
  const tx = { tournamentGroup: { findMany: vi.fn().mockResolvedValue(groups) }, fixture: {
    count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue(old), update: vi.fn().mockResolvedValue({}),
  }, auditLog: { create: vi.fn().mockResolvedValue({}) } };
  const prisma = { tournament: { findUnique: vi.fn().mockResolvedValue({ id: 't' }) }, tournamentGroup: { findMany: vi.fn().mockResolvedValue(groups) }, fixture: { count: vi.fn().mockResolvedValueOnce(220).mockResolvedValueOnce(0).mockResolvedValueOnce(11) }, $transactionWithRetry: vi.fn(async (fn) => fn(tx)) };
  const auth = { assertCanManageTournament: vi.fn().mockResolvedValue(undefined) };
  const service = new PlayoffsService(prisma as never, auth as never);
  return { old, tx, auth, run: () => service.generatePlayoffs('owner', 't', { qualifiersPerGroup: 1 }, true) };
}

describe('Existing playoff reseeding', () => {
  it('preserves IDs, updates only playoffs and audits the bracket', async () => {
    const { run, tx, auth, old } = setup();
    const result = await run();
    expect(result.data.fixtures).toBe(11);
    expect(result.data.qualifiersPerGroup).toBe(6);
    expect(auth.assertCanManageTournament).toHaveBeenCalledWith('owner', 't');
    expect(tx.fixture.update.mock.calls.every(([args]) => old.some((f) => f.id === args.where.id))).toBe(true);
    expect(tx.fixture.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'f4' }, data: expect.objectContaining({ homeRegistrationId: '1-0', awayRegistrationId: null }) }));
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });
  it.each(['resultSubmissions', 'statEvents', 'ocrExtractions', 'disputes'] as const)('blocks %s without writes', async (field) => {
    const { run, old, tx } = setup(); old[0].match._count[field] = 1;
    await expect(run()).rejects.toThrow('match activity'); expect(tx.fixture.update).not.toHaveBeenCalled();
  });
  it('blocks started fixtures', async () => {
    const { run, old, tx } = setup(); old[0].status = 'LIVE';
    await expect(run()).rejects.toThrow(); expect(tx.fixture.update).not.toHaveBeenCalled();
  });
  it('blocks changes to the qualified team set', async () => {
    const { run, old, tx } = setup(); old[0].homeRegistrationId = 'other';
    await expect(run()).rejects.toThrow('Qualified teams changed'); expect(tx.fixture.update).not.toHaveBeenCalled();
  });
  it('enforces authorization before mutation', async () => {
    const { run, auth, tx } = setup(); auth.assertCanManageTournament.mockRejectedValue(new Error('Forbidden'));
    await expect(run()).rejects.toThrow('Forbidden'); expect(tx.fixture.update).not.toHaveBeenCalled();
  });
});
