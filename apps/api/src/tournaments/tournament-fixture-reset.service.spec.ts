import { TournamentFixtureResetService } from './tournament-fixture-reset.service.js';

function harness(options: { played?: boolean; score?: boolean; fixtures?: number } = {}) {
  const fixtureCount = options.fixtures ?? 2;
  const fixture = {
    id: 'fixture-1',
    status: options.played ? 'COMPLETED' : 'SCHEDULED',
    scheduledAt: new Date(),
    publishedAt: new Date(),
    deadlineCase: null,
    match: {
      id: 'match-1', status: options.played ? 'COMPLETED' : 'SCHEDULED',
      homeReadyAt: null, awayReadyAt: null,
      confirmedResultSubmissionId: options.score ? 'score-1' : null,
      _count: {
        resultSubmissions: options.score ? 1 : 0,
        ocrExtractions: 0, statEvents: 0, disputes: 0,
      },
    },
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    tournament: {
      findUnique: vi.fn().mockResolvedValue({
        id: 't-1', name: 'INTERNATIONAL FRIENDLIES',
        status: 'REGISTRATION_CLOSED', wizardStep: 'PUBLISHED',
        fixturesGeneratedAt: new Date(), fixturesPublishedAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    fixture: {
      findMany: vi.fn().mockResolvedValue(Array.from({ length: fixtureCount }, (_, i) => ({ ...fixture, id: `fixture-${i}` }))),
      updateMany: vi.fn().mockResolvedValue({ count: fixtureCount }),
      deleteMany: vi.fn().mockResolvedValue({ count: fixtureCount }),
    },
    tournamentGroup: { count: vi.fn().mockResolvedValue(7), deleteMany: vi.fn().mockResolvedValue({ count: 7 }) },
    tournamentRegistration: { count: vi.fn().mockResolvedValue(42), updateMany: vi.fn().mockResolvedValue({ count: 42 }) },
    playerTournamentStatistic: { count: vi.fn().mockResolvedValue(0) },
    tournamentStanding: { count: vi.fn().mockResolvedValue(0), deleteMany: vi.fn().mockResolvedValue({ count: 42 }) },
    achievement: { count: vi.fn().mockResolvedValue(0) },
    tournamentSummary: { count: vi.fn().mockResolvedValue(0) },
    matchResultStatEvent: { count: vi.fn().mockResolvedValue(0) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn().mockImplementation((work: (db: typeof tx) => Promise<unknown>) => work(tx)),
    $transactionWithRetry: vi.fn().mockImplementation((work: (db: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const auth = { assertCanManageFixtures: vi.fn().mockResolvedValue(undefined), assertCanManageTournamentPermission: vi.fn().mockResolvedValue(undefined) };
  const service = new TournamentFixtureResetService(prisma as never, auth as never);
  return { tx, auth, service };
}

describe('tournament fixture reset safety', () => {
  it('previews scheduled-only fixtures without modifying live records', async () => {
    const { service, tx } = harness();
    const response = await service.preview('admin', 't-1');
    expect(response.data.allowed).toBe(true);
    expect(response.data.scheduledCount).toBe(2);
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });

  it('requires the exact tournament name before deleting anything', async () => {
    const { service, tx } = harness();
    await expect(service.reset('admin', 't-1', 'WRONG NAME')).rejects.toThrow();
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });

  it('atomically resets scheduled-only fixtures and preserves groups and entries', async () => {
    const { service, tx, auth } = harness();
    const result = await service.reset('admin', 't-1', 'INTERNATIONAL FRIENDLIES');
    expect(result.data.deletedFixtures).toBe(2);
    expect(tx.fixture.updateMany).toHaveBeenCalled();
    expect(tx.fixture.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: 't-1' } });
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { fixturesGeneratedAt: null, fixturesPublishedAt: null, wizardStep: 'GROUPS' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(auth.assertCanManageFixtures).toHaveBeenCalledTimes(1);
  });

  it.each([{ played: true }, { score: true }])('refuses to wipe results or played activity (%j)', async options => {
    const { service, tx } = harness(options);
    const preview = await service.preview('admin', 't-1');
    expect(preview.data.allowed).toBe(false);
    await expect(service.reset('admin', 't-1', 'INTERNATIONAL FRIENDLIES')).rejects.toThrow();
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses resets when player match statistics have been recorded', async () => {
    const { service, tx } = harness();
    tx.playerTournamentStatistic.count.mockResolvedValueOnce(1);
    const preview = await service.preview('admin', 't-1');
    expect(preview.data.allowed).toBe(false);
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });
  it('allows ready clicks on unplayed fixtures to be cleared by an explicit admin reset', async () => {
    const { service, tx } = harness();
    const fixtures = await tx.fixture.findMany();
    fixtures[0].match.homeReadyAt = new Date() as never;
    fixtures[1].match.awayReadyAt = new Date() as never;
    tx.fixture.findMany.mockResolvedValue(fixtures);
    const preview = await service.previewFullDraw('admin', 't-1');
    expect(preview.data).toMatchObject({ allowed: true, readinessCount: 2 });
    await service.resetFullDraw('admin', 't-1', 'INTERNATIONAL FRIENDLIES');
    expect(tx.fixture.deleteMany).toHaveBeenCalled();
    expect(tx.tournamentGroup.deleteMany).toHaveBeenCalled();
  });
  it('previews complete group and fixture reset while keeping approved participants', async () => {
    const { service, tx, auth } = harness();
    const preview = await service.previewFullDraw('admin', 't-1');
    expect(preview.data.allowed).toBe(true);
    expect(preview.data.groupCount).toBe(7);
    expect(preview.data.approvedTeams).toBe(42);
    expect(tx.tournamentGroup.deleteMany).not.toHaveBeenCalled();
    expect(tx.tournamentRegistration.updateMany).not.toHaveBeenCalled();
    expect(auth.assertCanManageTournamentPermission).toHaveBeenCalledWith(
      'admin', 't-1', 'MANAGE_PARTICIPANTS',
    );
  });

  it('clears all groups, group assignments, and generated fixtures atomically', async () => {
    const { service, tx } = harness();
    const result = await service.resetFullDraw('admin', 't-1', 'INTERNATIONAL FRIENDLIES');
    expect(result.data.deletedGroups).toBe(7);
    expect(result.data.deletedFixtures).toBe(2);
    expect(result.data.keptApprovedTeams).toBe(42);
    expect(tx.fixture.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: 't-1' } });
    expect(tx.tournamentRegistration.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: 't-1' }, data: { groupId: null },
    });
    expect(tx.tournamentGroup.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: 't-1' } });
    expect(tx.tournamentStanding.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: 't-1' } });
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 't-1' }, data: {
        status: 'REGISTRATION_CLOSED', fixturesGeneratedAt: null,
        fixturesPublishedAt: null, qualifiersPerGroup: null,
        playoffQualifiersTotal: null, wizardStep: 'GROUPS',
      },
    });
  });

  it('rejects incorrect confirmation without deleting groups or fixtures', async () => {
    const { service, tx } = harness();
    await expect(service.resetFullDraw('admin', 't-1', 'WRONG')).rejects.toThrow();
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
    expect(tx.tournamentGroup.deleteMany).not.toHaveBeenCalled();
  });

  it.each([{ played: true }, { score: true }])(
    'blocks full reset if results or match activity exists (%j)', async opts => {
      const { service, tx } = harness(opts);
      expect((await service.previewFullDraw('admin', 't-1')).data.allowed).toBe(false);
      await expect(service.resetFullDraw('admin', 't-1', 'INTERNATIONAL FRIENDLIES')).rejects.toThrow();
      expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
      expect(tx.tournamentGroup.deleteMany).not.toHaveBeenCalled();
    },
  );
  it('rejects full reset if admin has no participants permission', async () => {
    const { service, auth, tx } = harness();
    auth.assertCanManageTournamentPermission.mockRejectedValueOnce(new Error('permission denied'));
    await expect(service.resetFullDraw('admin', 't-1', 'INTERNATIONAL FRIENDLIES')).rejects.toThrow();
    expect(tx.tournamentRegistration.updateMany).not.toHaveBeenCalled();
  });

});
