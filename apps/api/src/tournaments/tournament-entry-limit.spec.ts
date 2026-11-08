import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { UpdateEntryLimitDto } from './dto/update-entry-limit.dto.js';
import { TournamentsService } from './tournaments.service.js';
import { TournamentEntriesService } from './tournament-entries.service.js';

function setup(status = 'REGISTRATION_OPEN', fixtures = 0) {
  const tournament = { id: 'cup', leagueId: 'league', status, maxEntries: 20, wizardStep: 'TEAMS',
    groupMode: 'SINGLE_GROUP', registrationClosedAt: null as Date | null, mode: 'SOLO', teamSize: 1,
    competitionFormat: 'UCL_CUP', format: 'ROUND_ROBIN' };
  const entries = Array.from({ length: 20 }, (_, i) => ({ id: `entry-${i}`, entryName: `Team ${i}`, status: 'APPROVED' }));
  const tx = {
    tournament: {
      findUnique: vi.fn(async () => ({ ...tournament })),
      update: vi.fn(async ({ data }: { data: Partial<typeof tournament> }) => Object.assign(tournament, data)),
    },
    fixture: { count: vi.fn().mockResolvedValue(fixtures) },
    tournamentRegistration: {
      findMany: vi.fn(async () => entries),
      count: vi.fn(async ({ where }: { where: { status?: unknown } }) =>
        entries.filter(entry => typeof where.status !== 'string' || entry.status === where.status).length),
      findFirst: vi.fn().mockResolvedValue({ sortOrder: 19 }),
      create: vi.fn(async ({ data }: { data: { entryName: string } }) => {
        const entry = { id: `entry-${entries.length}`, status: 'APPROVED', ...data };
        entries.push(entry);
        return entry;
      }),
    },
  };
  const db = {
    tournament: { findUnique: vi.fn(async () => ({ ...tournament })) },
    fixture: tx.fixture,
    $transactionWithRetry: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(tx)),
  };
  const auth = { assertCanManageTournamentPermission: vi.fn(), assertCanManageFixtures: vi.fn() };
  return { tournament, entries, db, tx, auth,
    service: new TournamentsService(db as never, auth as never),
    entryService: new TournamentEntriesService(db as never, auth as never),
  };
}

describe('Tournament entry limit extension', () => {
  it.each(['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'])('extends 20 to 22 during %s without resetting setup or entries', async status => {
    const { service, tournament, entries, tx, auth, db } = setup(status);
    const before = structuredClone(entries);
    await expect(service.updateEntryLimit('owner', 'cup', { maxEntries: 22 })).resolves.toMatchObject({
      success: true, data: { previousMaxEntries: 20, maxEntries: 22 },
    });
    expect(tournament).toMatchObject({ status, wizardStep: 'TEAMS', maxEntries: 22 });
    expect(entries).toEqual(before);
    expect(tx.tournament.update).toHaveBeenCalledWith({ where: { id: 'cup' }, data: { maxEntries: 22 } });
    expect(auth.assertCanManageTournamentPermission).toHaveBeenCalledWith('owner', 'cup', 'MANAGE_SETTINGS');
    expect(db.$transactionWithRetry).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('admits the two extra entries after extension and still rejects a 23rd', async () => {
    const { service, entryService, entries } = setup();
    await expect(entryService.createEntry('owner', 'cup', { entryName: 'Extra One' })).rejects.toMatchObject({
      response: { error: { code: 'TOURNAMENT_ENTRY_LIMIT_REACHED' } },
    });
    await service.updateEntryLimit('owner', 'cup', { maxEntries: 22 });
    await entryService.createEntry('owner', 'cup', { entryName: 'Extra One' });
    await entryService.createEntry('owner', 'cup', { entryName: 'Extra Two' });
    expect(entries).toHaveLength(22);
    await expect(entryService.createEntry('owner', 'cup', { entryName: 'Extra Three' })).rejects.toMatchObject({
      response: { error: { code: 'TOURNAMENT_ENTRY_LIMIT_REACHED' } },
    });
  });

  it('does not allow a settings update from an unauthorized player', async () => {
    const { service, auth, db, tournament } = setup();
    auth.assertCanManageTournamentPermission.mockRejectedValue(new Error('forbidden'));
    await expect(service.updateEntryLimit('player', 'cup', { maxEntries: 22 })).rejects.toThrow('forbidden');
    expect(db.$transactionWithRetry).not.toHaveBeenCalled();
    expect(tournament.maxEntries).toBe(20);
  });

  it.each(['ACTIVE', 'COMPLETED', 'CANCELLED'])('protects a %s tournament', async status => {
    const { service, tx } = setup(status);
    await expect(service.updateEntryLimit('owner', 'cup', { maxEntries: 22 })).rejects.toMatchObject({
      response: { error: { code: 'TOURNAMENT_ENTRY_LIMIT_LOCKED' } },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it('protects generated fixtures even if tournament registration is closed', async () => {
    const { service, tx } = setup('REGISTRATION_CLOSED', 1);
    await expect(service.updateEntryLimit('owner', 'cup', { maxEntries: 22 })).rejects.toMatchObject({
      response: { error: { code: 'TOURNAMENT_ENTRY_LIMIT_LOCKED' } },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it('rechecks lifecycle changes inside the transaction', async () => {
    const { service, tx } = setup();
    tx.tournament.findUnique.mockResolvedValueOnce({ ...setup().tournament, status: 'ACTIVE', wizardStep: 'REVIEW' });
    await expect(service.updateEntryLimit('owner', 'cup', { maxEntries: 22 })).rejects.toMatchObject({
      response: { error: { code: 'TOURNAMENT_ENTRY_LIMIT_LOCKED' } },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it('rejects a limit below approved entries and handles a repeated save without another write', async () => {
    const { service, tx, tournament } = setup();
    await expect(service.updateEntryLimit('owner', 'cup', { maxEntries: 19 })).rejects.toMatchObject({
      response: { error: { code: 'ENTRY_LIMIT_BELOW_APPROVED_COUNT' } },
    });
    await service.updateEntryLimit('owner', 'cup', { maxEntries: 20 });
    expect(tx.tournament.update).not.toHaveBeenCalled();
    expect(tournament.maxEntries).toBe(20);
  });

  it('reduces 24 to 22 after a team is removed and preserves all remaining entries', async () => {
    const { service, entries, tournament } = setup();
    tournament.maxEntries = 24;
    entries.push({ id: 'extra-one', entryName: 'Extra One', status: 'APPROVED' },
      { id: 'extra-two', entryName: 'Extra Two', status: 'APPROVED' },
      { id: 'removed', entryName: 'Removed Club', status: 'APPROVED' });
    entries.pop();
    const before = structuredClone(entries);
    await expect(service.updateEntryLimit('owner', 'cup', { maxEntries: 22 })).resolves.toMatchObject({
      data: { previousMaxEntries: 24, maxEntries: 22 },
    });
    expect(entries).toEqual(before);
    expect(tournament.maxEntries).toBe(22);
  });

  it('supports reductions from the maximum of 128', async () => {
    const { service, tournament } = setup();
    tournament.maxEntries = 128;
    await service.updateEntryLimit('owner', 'cup', { maxEntries: 22 });
    expect(tournament.maxEntries).toBe(22);
  });

  it('protects approved entries through the draft setup editor too', async () => {
    const { service, tx } = setup('DRAFT');
    await expect(service.updateTournamentSetup('owner', 'cup', { maxEntries: 19 })).rejects.toMatchObject({
      response: { error: { code: 'ENTRY_LIMIT_BELOW_APPROVED_COUNT' } },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it('uses the current limit when a manual entry races a reduction', async () => {
    const { entryService, tx, tournament } = setup();
    tournament.maxEntries = 24;
    tx.tournament.findUnique.mockResolvedValueOnce({ ...tournament, maxEntries: 20 });
    await expect(entryService.createEntry('owner', 'cup', { entryName: 'Extra' })).rejects.toMatchObject({
      response: { error: { code: 'TOURNAMENT_ENTRY_LIMIT_REACHED' } },
    });
    expect(tx.tournamentRegistration.create).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 0, 1, 129, 20.5, '22', Number.NaN])('rejects an invalid limit: %s', async maxEntries => {
    const dto = Object.assign(new UpdateEntryLimitDto(), { maxEntries });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it.each([21, 22, 128])('accepts a whole-number limit of %i', async maxEntries => {
    expect(await validate(Object.assign(new UpdateEntryLimitDto(), { maxEntries }))).toHaveLength(0);
  });
});

describe('Admin starts fixture setup with the current approved teams', () => {
  it.each(['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'])('starts with 20 of 24 teams from %s', async status => {
    const { service, tournament, auth, tx } = setup(status);
    tournament.maxEntries = 24;
    await expect(service.prepareFixtures('owner', 'cup')).resolves.toMatchObject({
      data: { approvedEntries: 20, maxEntries: 24, nextStep: 'FIXTURE_SETTINGS' },
    });
    expect(tournament).toMatchObject({ status: 'REGISTRATION_CLOSED', maxEntries: 24, wizardStep: 'FIXTURE_SETTINGS' });
    expect(tournament.registrationClosedAt).toBeInstanceOf(Date);
    expect(auth.assertCanManageFixtures).toHaveBeenCalledWith('owner', 'cup');
    expect(tx.tournamentRegistration.create).not.toHaveBeenCalled();
  });

  it('takes multiple-group competitions to group setup', async () => {
    const { service, tournament } = setup();
    tournament.groupMode = 'MULTIPLE_GROUPS';
    expect((await service.prepareFixtures('owner', 'cup')).data.nextStep).toBe('GROUPS');
  });

  it('requires pending applications to be reviewed without changing their status', async () => {
    const { service, tournament, entries, tx } = setup();
    entries[0].status = 'PENDING';
    await expect(service.prepareFixtures('owner', 'cup')).rejects.toMatchObject({
      response: { error: { code: 'PENDING_REGISTRATIONS_EXIST' } },
    });
    expect(tournament.status).toBe('REGISTRATION_OPEN');
    expect(entries[0].status).toBe('PENDING');
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it('requires at least two approved teams', async () => {
    const { service, entries, tx } = setup();
    entries.splice(1);
    await expect(service.prepareFixtures('owner', 'cup')).rejects.toMatchObject({
      response: { error: { code: 'NOT_ENOUGH_TEAMS' } },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it.each(['ACTIVE', 'COMPLETED', 'CANCELLED'])('does not reopen a %s tournament', async status => {
    const { service, tx } = setup(status);
    await expect(service.prepareFixtures('owner', 'cup')).rejects.toMatchObject({
      response: { error: { code: 'TOURNAMENT_FIXTURE_SETUP_LOCKED' } },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it('does not reset an existing fixture preview', async () => {
    const { service, tx } = setup('REGISTRATION_CLOSED', 1);
    await expect(service.prepareFixtures('owner', 'cup')).rejects.toMatchObject({
      response: { error: { code: 'TOURNAMENT_FIXTURE_SETUP_LOCKED' } },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it('requires both participant management and fixture permission', async () => {
    const { service, auth, db } = setup();
    auth.assertCanManageFixtures.mockRejectedValue(new Error('forbidden'));
    await expect(service.prepareFixtures('player', 'cup')).rejects.toThrow('forbidden');
    expect(auth.assertCanManageTournamentPermission).toHaveBeenCalledWith('player', 'cup', 'MANAGE_PARTICIPANTS');
    expect(db.$transactionWithRetry).not.toHaveBeenCalled();
  });
});
