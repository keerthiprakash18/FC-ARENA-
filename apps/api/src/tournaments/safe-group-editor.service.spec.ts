import { SafeGroupEditorService } from './safe-group-editor.service.js';

const groupA = { id: 'group-a', name: 'Group A' };
const groupB = { id: 'group-b', name: 'Group B' };
const registrations = [
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `A${i}`, groupId: groupA.id,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `B${i}`, groupId: groupB.id,
  })),
];
const makeHarness = (fixtureCount = 0, affectedFixtures: unknown[] = []) => {
  const tx = {
    tournament: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'tournament-id',
        status: 'REGISTRATION_CLOSED',
        groupMode: 'MULTIPLE_GROUPS',
        competitionFormat: 'GROUP_STAGE_KNOCKOUT',
        legType: 'SINGLE_LEG',
        fixturesPublishedAt: null,
      }),
    },
    tournamentGroup: { findMany: vi.fn().mockResolvedValue([groupA, groupB]) },
    tournamentRegistration: {
      findMany: vi.fn().mockResolvedValue(registrations),
      update: vi.fn().mockResolvedValue({}),
    },
    fixture: {
      count: vi.fn().mockImplementation(({ where }: { where: { OR?: unknown } }) =>
        Promise.resolve(where.OR ? 0 : fixtureCount)),
      findMany: vi.fn().mockResolvedValue(affectedFixtures),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'created-fixture' }),
    },
    match: { create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transactionWithRetry: vi.fn().mockImplementation((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const authorization = {
    assertCanManageTournamentPermission: vi.fn().mockResolvedValue(undefined),
  };
  const service = new SafeGroupEditorService(prisma as never, authorization as never);
  return { tx, authorization, service };
};

describe('safe group editor', () => {
  it('atomically swaps two teams without breaking an even 3/3 draw', async () => {
    const { tx, authorization, service } = makeHarness();
    const result = await service.swap('admin', 'tournament-id', 'A0', 'B0');
    expect(result.data.changedTeams).toBe(2);
    expect(result.data.regeneratedFixtures).toBe(0);
    expect(tx.tournamentRegistration.update).toHaveBeenCalledTimes(2);
    expect(tx.tournamentRegistration.update).toHaveBeenCalledWith({
      where: { id: 'A0' }, data: { groupId: 'group-b' },
    });
    expect(tx.tournamentRegistration.update).toHaveBeenCalledWith({
      where: { id: 'B0' }, data: { groupId: 'group-a' },
    });
    expect(authorization.assertCanManageTournamentPermission).toHaveBeenCalledTimes(2);
  });

  it('refuses a one-sided move that would make existing fixture groups uneven', async () => {
    const { tx, service } = makeHarness(1);
    await expect(service.move('admin', 'tournament-id', 'A0', groupB.id)).rejects.toMatchObject({
      response: { error: { code: 'GROUPS_UNBALANCED' } },
    });
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
    expect(tx.tournamentRegistration.update).not.toHaveBeenCalled();
  });

  it('never deletes scheduled or played fixtures when a swap is requested', async () => {
    const { tx, service } = makeHarness(1, [{
      groupId: groupA.id, status: 'SCHEDULED',
      scheduledAt: new Date(), resultDeadlineAt: null, venue: null,
      deadlineCase: null, nextFixtureId: null, loserNextFixtureId: null,
      publishedAt: new Date(),
      match: {
        status: 'SCHEDULED', confirmedResultSubmissionId: null,
        homeReadyAt: null, awayReadyAt: null,
        _count: { resultSubmissions: 0, ocrExtractions: 0, statEvents: 0, disputes: 0 },
      },
    }]);
    await expect(service.swap('admin', 'tournament-id', 'A0', 'B0')).rejects.toMatchObject({
      response: { error: { code: 'GROUP_FIXTURES_HAVE_ACTIVITY' } },
    });
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
    expect(tx.tournamentRegistration.update).not.toHaveBeenCalled();
  });

  it('rejects swap attempts within the same group', async () => {
    const { tx, service } = makeHarness(0);
    await expect(service.swap('admin', 'tournament-id', 'A0', 'A1')).rejects.toMatchObject({
      response: { error: { code: 'SWAP_REQUIRES_DIFFERENT_GROUPS' } },
    });
    expect(tx.tournamentRegistration.update).not.toHaveBeenCalled();
  });
});
