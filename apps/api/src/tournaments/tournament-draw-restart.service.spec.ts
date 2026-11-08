import { TournamentDrawRestartService } from './tournament-draw-restart.service.js';

function harness({ teams = 42, recordedResults = 3 }: { teams?: number; recordedResults?: number } = {}) {
  const source = {
    id: 'old-tournament',
    leagueId: 'league-1',
    createdByUserId: 'admin',
    name: 'INTERNATIONAL FRIENDLIES',
    code: 'FCA-T-OLD',
    description: null,
    rules: null,
    mode: 'SOLO',
    format: 'ROUND_ROBIN',
    competitionFormat: 'GROUP_STAGE_KNOCKOUT',
    groupMode: 'MULTIPLE_GROUPS',
    legType: 'SINGLE_LEG',
    fixtureMode: 'AUTOMATIC',
    visibility: 'LEAGUE',
    registrationMode: 'APPROVAL',
    teamSize: 1,
    maxEntries: 42,
    logoUrl: null,
    playoffPairingMethod: 'CROSS_GROUP',
    playoffFormat: 'PROTECTED_SEED',
    playoffSource: 'AUTO',
    playoffSeedingBasis: 'AUTO',
    avoidSameGroupEarly: true,
    dailyMatchLimit: 10,
    matchesPerParticipantPerDay: 1,
    matchDurationMinutes: 30,
    resultDeadlineHours: 24,
    maxAdmins: 5,
    admins: [{ userId: 'admin', role: 'OWNER', permissions: ['MANAGE_SETTINGS'] }],
    registrations: Array.from({ length: teams }, (_, index) => ({
      id: `old-entry-${index}`,
      registeredByUserId: `player-${index}`,
      entryName: `Team ${index + 1}`,
      entryLogoUrl: null,
      sortOrder: index,
      members: [{ userId: `player-${index}` }],
    })),
    groups: Array.from({ length: 7 }, (_, index) => ({ id: `group-${index}` })),
    _count: { groups: 7, fixtures: recordedResults, registrations: teams },
  };
  const tx = {
    tournament: {
      findUnique: vi.fn().mockResolvedValue(source),
      create: vi.fn().mockImplementation(async ({ data }) => data),
    },
    tournamentAdmin: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    tournamentRegistration: { createMany: vi.fn().mockResolvedValue({ count: teams }) },
    tournamentRegistrationMember: { createMany: vi.fn().mockResolvedValue({ count: teams }) },
    tournamentGroup: { createMany: vi.fn().mockResolvedValue({ count: 7 }) },
    auditLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    fixture: { deleteMany: vi.fn() },
    match: { deleteMany: vi.fn() },
  };
  const prisma = {
    tournament: { findUnique: vi.fn().mockResolvedValue(source) },
    $transactionWithRetry: vi.fn().mockImplementation((work: (db: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const authorization = {
    assertCanManageTournamentPermission: vi.fn().mockResolvedValue(undefined),
  };
  return { tx, prisma, authorization, service: new TournamentDrawRestartService(prisma as never, authorization as never) };
}

describe('draw restart keeps old match history and copies approved teams', () => {
  it('previews restart even if previous tournament has recorded results', async () => {
    const { service, tx } = harness();
    const preview = await service.preview('admin', 'old-tournament');
    expect(preview.data.approvedTeamsToCarry).toBe(42);
    expect(preview.data.groupsToSetUp).toBe(7);
    expect(preview.data.originalHistoryPreserved).toBe(true);
    expect(tx.tournament.create).not.toHaveBeenCalled();
  });

  it('creates fresh group setup with all 42 approved teams and preserves source results', async () => {
    const { service, tx } = harness();
    const response = await service.restart('admin', 'old-tournament', 'INTERNATIONAL FRIENDLIES');
    expect(response.data.carriedTeams).toBe(42);
    expect(response.data.groupCount).toBe(7);
    expect(tx.tournament.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'REGISTRATION_CLOSED',
        wizardStep: 'GROUPS',
        name: 'INTERNATIONAL FRIENDLIES (New Draw)',
      }),
    });
    const createData = tx.tournament.create.mock.calls[0][0].data;
    expect(createData.code).not.toBe('FCA-T-OLD');
    const registrationData = tx.tournamentRegistration.createMany.mock.calls[0][0].data;
    expect(registrationData).toHaveLength(42);
    expect(registrationData.every((entry: { groupId: null }) => entry.groupId === null)).toBe(true);
    expect(tx.tournamentRegistrationMember.createMany.mock.calls[0][0].data).toHaveLength(42);
    expect(tx.tournamentGroup.createMany.mock.calls[0][0].data).toHaveLength(7);
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled();
    expect(tx.match.deleteMany).not.toHaveBeenCalled();
  });

  it('denies restart with incorrect tournament name without creating any record', async () => {
    const { service, tx } = harness();
    await expect(service.restart('admin', 'old-tournament', 'WRONG')).rejects.toThrow();
    expect(tx.tournament.create).not.toHaveBeenCalled();
  });

  it('denies restart if admin lacks participant management permission', async () => {
    const { service, tx, authorization } = harness();
    authorization.assertCanManageTournamentPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(service.restart('admin', 'old-tournament', 'INTERNATIONAL FRIENDLIES')).rejects.toThrow();
    expect(tx.tournament.create).not.toHaveBeenCalled();
  });

  it('refuses to create empty restart when no teams are approved', async () => {
    const { service, tx } = harness({ teams: 0 });
    await expect(service.restart('admin', 'old-tournament', 'INTERNATIONAL FRIENDLIES')).rejects.toThrow();
    expect(tx.tournament.create).not.toHaveBeenCalled();
  });

  it('reuses an already generated restart link on repeated clicks', async () => {
    const { service, tx } = harness();
    tx.auditLog.findFirst.mockResolvedValueOnce({
      afterData: { newTournamentId: 'new-id' },
    });
    tx.tournament.findUnique.mockResolvedValueOnce({
      id: 'old-tournament', name: 'INTERNATIONAL FRIENDLIES', code: 'FCA-T-OLD',
      admins: [], registrations: Array.from({ length: 42 }, (_, i) => ({
        id: String(i), members: [], sortOrder: i, registeredByUserId: `user-${i}`,
      })), groups: Array.from({ length: 7 }, (_, i) => ({ id: String(i) })),
    }).mockResolvedValueOnce({ id: 'new-id', name: 'New Draw', code: 'FCA-T-NEW' });
    const result = await service.restart('admin', 'old-tournament', 'INTERNATIONAL FRIENDLIES');
    expect(result.data.alreadyCreated).toBe(true);
    expect(result.data.tournamentId).toBe('new-id');
    expect(tx.tournament.create).not.toHaveBeenCalled();
  });
});
