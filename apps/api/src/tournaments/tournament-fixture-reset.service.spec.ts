import { TournamentFixtureResetService } from './tournament-fixture-reset.service.js';

function harness(options: {
  status?: string;
  fixtures?: number;
  matches?: number;
  protectedMatches?: number;
  standings?: number;
  achievements?: number;
  summary?: boolean;
} = {}) {
  const tournament = {
    id: 'tournament-id',
    name: 'INTERNATIONAL FRIENDLIES',
    code: 'FCA-T-UE22UX',
    status: options.status ?? 'REGISTRATION_CLOSED',
    groupMode: 'MULTIPLE_GROUPS',
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: tournament.id }]),
    tournament: {
      findUnique: vi.fn().mockResolvedValue(tournament),
      update: vi.fn().mockResolvedValue(tournament),
    },
    fixture: {
      count: vi.fn().mockImplementation(({ where }: any) => {
        if (where.status?.in?.includes('LIVE')) return Promise.resolve(0);
        if (where.OR) return Promise.resolve(2);
        if (where.publishedAt) return Promise.resolve(3);
        return Promise.resolve(options.fixtures ?? 12);
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: options.fixtures ?? 12 }),
    },
    match: {
      count: vi.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.OR ? (options.protectedMatches ?? 0) : (options.matches ?? 12))),
    },
    tournamentStanding: { count: vi.fn().mockResolvedValue(options.standings ?? 0) },
    achievement: { count: vi.fn().mockResolvedValue(options.achievements ?? 0) },
    tournamentSummary: { findUnique: vi.fn().mockResolvedValue(options.summary ? { id: 'summary' } : null) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ...tx,
    $transactionWithRetry: vi.fn().mockImplementation((callback: (db: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const auth = { assertCanManageTournamentPermission: vi.fn().mockResolvedValue(undefined) };
  const service = new TournamentFixtureResetService(prisma as never, auth as never);
  return { tx, auth, service };
}

describe('tournament fixture full-reset safeguards', () => {
  it('returns accurate impact counts for the admin before deletion', async () => {
    const { service, tx } = harness();
    const response = await service.impact('admin', 'tournament-id');
    expect(response.data).toMatchObject({
      tournamentCode: 'FCA-T-UE22UX',
      fixtures: 12,
      matches: 12,
      scheduled: 2,
      published: 3,
      canReset: true,
    });
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes scheduled/unplayed fixtures and preserves tournament/groups/registration', async () => {
    const { service, tx, auth } = harness();
    const result = await service.reset('admin', 'tournament-id', 'RESET FCA-T-UE22UX');
    expect(result.data).toMatchObject({ deleted: 12, nextStep: 'GROUPS' });
    expect(tx.fixture.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: 'tournament-id' } });
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 'tournament-id' },
      data: {
        fixturesGeneratedAt: null, fixturesPublishedAt: null,
        status: 'REGISTRATION_CLOSED', wizardStep: 'GROUPS',
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(auth.assertCanManageTournamentPermission).toHaveBeenCalledTimes(2);
  });

  it('rejects even a scheduled reset when tournament code confirmation is wrong', async () => {
    const { service, tx } = harness();
    await expect(service.reset('admin', 'tournament-id', 'RESET WRONG')).rejects.toMatchObject({
      response: { error: { code: 'FIXTURE_RESET_CONFIRMATION_MISMATCH' } },
    });
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks the reset when scored / disputed / active match records exist', async () => {
    const { service, tx } = harness({ protectedMatches: 1 });
    const impact = await service.impact('admin', 'tournament-id');
    expect(impact.data.canReset).toBe(false);
    await expect(service.reset('admin', 'tournament-id', 'RESET FCA-T-UE22UX')).rejects.toMatchObject({
      response: { error: { code: 'FIXTURE_RESET_UNSAFE' } },
    });
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks after result-derived standings or awards exist', async () => {
    const { service, tx } = harness({ standings: 1, achievements: 1 });
    await expect(service.reset('admin', 'tournament-id', 'RESET FCA-T-UE22UX')).rejects.toMatchObject({
      response: { error: { code: 'FIXTURE_RESET_UNSAFE' } },
    });
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects completed tournaments regardless of status of fixtures', async () => {
    const { service, tx } = harness({ status: 'COMPLETED' });
    await expect(service.reset('admin', 'tournament-id', 'RESET FCA-T-UE22UX')).rejects.toMatchObject({
      response: { error: { code: 'FIXTURE_RESET_UNSAFE' } },
    });
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });

  it('requires both settings and fixtures management rights', async () => {
    const { service, auth, tx } = harness();
    auth.assertCanManageTournamentPermission.mockRejectedValueOnce(new Error('Not authorized'));
    await expect(service.reset('admin', 'tournament-id', 'RESET FCA-T-UE22UX')).rejects.toThrow('Not authorized');
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
  });
});
