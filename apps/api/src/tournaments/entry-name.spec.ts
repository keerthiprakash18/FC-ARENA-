import { describe, expect, it, vi } from 'vitest';
import { assertUniqueEntryName, normalizeEntryName } from './entry-name.js';
import { TournamentEntriesService } from './tournament-entries.service.js';
import { TournamentsService } from './tournaments.service.js';

type Entry = { id: string; tournamentId: string; entryName: string; status: string };
function setup(mode = 'OPEN', rows: Entry[] = []) {
  const tournament = { id: 'cup', leagueId: 'league', status: 'REGISTRATION_OPEN', registrationMode: mode, teamSize: 1, maxEntries: 32 };
  const player = { userId: 'user', playerCode: 'FCA-1', identity: { inGameName: 'Player' }, user: { id: 'user', fullName: 'Player' } };
  const db = {
    tournament: { findUnique: vi.fn().mockResolvedValue(tournament), findUniqueOrThrow: vi.fn().mockResolvedValue(tournament) },
    leagueAdmin: { findUnique: vi.fn().mockResolvedValue({}) },
    leagueMember: { findUnique: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(1) },
    fixture: { count: vi.fn().mockResolvedValue(0) },
    player: { findUnique: vi.fn().mockResolvedValue(player), findMany: vi.fn().mockResolvedValue([player]) },
    tournamentRegistrationMember: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    tournamentRegistration: {
      findMany: vi.fn(async ({ where }: { where: { tournamentId: string; status?: { in: string[] }; id?: { not: string } } }) => rows.filter(row => row.tournamentId === where.tournamentId && (!where.status || where.status.in.includes(row.status)) && row.id !== where.id?.not)),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.find(row => row.id === where.id)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'edit', ...data })),
    },
    $transactionWithRetry: vi.fn(),
    $transaction: vi.fn(),
  };
  db.$transactionWithRetry.mockImplementation(async work => work(db));
  db.$transaction.mockImplementation(async work => work(db));
  const authorization = { assertCanManageTournament: vi.fn(), assertCanManageTournamentPermission: vi.fn() };
  return {
    db,
    admin: new TournamentEntriesService(db as never, authorization as never),
    players: new TournamentsService(db as never, { assertCanManageTournament: vi.fn(), assertCanManageTournamentPermission: vi.fn() } as never),
  };
}
const city = { id: 'city', tournamentId: 'cup', entryName: 'Manchester City', status: 'APPROVED' };

describe('tournament team name uniqueness', () => {
  it('normalizes case, Unicode forms and repeated whitespace without merging different words', () => {
    expect(normalizeEntryName('  Ｍanchester\t CITY  ')).toBe('manchester city');
    expect(normalizeEntryName('AC Milan')).not.toBe(normalizeEntryName('ACMilan'));
  });

  for (const status of ['APPROVED', 'PENDING']) {
    for (const mode of ['OPEN', 'APPROVAL']) {
      it(`rejects a ${status} team during ${mode} self-registration before writing members`, async () => {
        const { db, players } = setup(mode, [{ ...city, status }]);
        await expect(players.register('user', 'cup', { entryName: '  MANCHESTER   city ', inGameName: 'Player' })).rejects.toMatchObject({
          response: { error: { code: 'ENTRY_NAME_ALREADY_EXISTS', message: expect.stringContaining('already exists') } },
        });
        expect(db.tournamentRegistration.create).not.toHaveBeenCalled();
        expect(db.tournamentRegistrationMember.createMany).not.toHaveBeenCalled();
      });
    }
  }

  it.each(['OPEN', 'APPROVAL'])('allows a new team in %s mode and preserves registration status', async mode => {
    const { players } = setup(mode, [city]);
    const result = await players.register('user', 'cup', { entryName: 'Arsenal', inGameName: 'Player' });
    expect(result.data.registration).toMatchObject({ entryName: 'Arsenal', status: mode === 'OPEN' ? 'APPROVED' : 'PENDING' });
  });

  it('does not reserve names from rejected applications or other tournaments', async () => {
    const { db } = setup('OPEN', [{ ...city, status: 'REJECTED' }, { ...city, id: 'other', tournamentId: 'other-cup' }]);
    await expect(assertUniqueEntryName(db as never, 'cup', 'Manchester City')).resolves.toBeUndefined();
  });

  it('blocks manual duplicates with the same comparison as player registration', async () => {
    const { admin, db } = setup('OPEN', [city]);
    await expect(admin.createEntry('user', 'cup', { entryName: 'Manchester\u00a0 City' })).rejects.toMatchObject({ response: { error: { code: 'ENTRY_NAME_ALREADY_EXISTS' } } });
    expect(db.tournamentRegistration.create).not.toHaveBeenCalled();
    expect(db.$transactionWithRetry).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('blocks duplicates within a bulk import without writing any teams', async () => {
    const { admin, db } = setup();
    await expect(admin.bulkCreateEntries('user', 'cup', { names: ['Real Madrid', ' real   madrid '] })).rejects.toMatchObject({ response: { error: { code: 'DUPLICATE_BULK_ENTRY' } } });
    expect(db.tournamentRegistration.create).not.toHaveBeenCalled();
  });

  it('rejects the whole bulk import and names the existing team', async () => {
    const { admin, db } = setup('OPEN', [city]);
    await expect(admin.bulkCreateEntries('user', 'cup', { names: ['Arsenal', 'MANCHESTER CITY'] })).rejects.toMatchObject({ response: { error: { message: expect.stringContaining('MANCHESTER CITY') } } });
    expect(db.tournamentRegistration.create).not.toHaveBeenCalled();
  });

  it('allows distinct manual and bulk additions', async () => {
    const { admin, db } = setup();
    await admin.createEntry('user', 'cup', { entryName: 'Arsenal' });
    await admin.bulkCreateEntries('user', 'cup', { names: ['Liverpool', 'Real Madrid'] });
    expect(db.tournamentRegistration.create).toHaveBeenCalledTimes(3);
  });

  it('allows editing the same team but not renaming it to another team', async () => {
    const { admin, db } = setup('OPEN', [city, { ...city, id: 'arsenal', entryName: 'Arsenal' }]);
    await admin.updateEntry('user', 'cup', 'city', { entryName: ' MANCHESTER CITY ' });
    await expect(admin.updateEntry('user', 'cup', 'city', { entryName: 'arsenal' })).rejects.toMatchObject({ response: { error: { code: 'ENTRY_NAME_ALREADY_EXISTS' } } });
    expect(db.tournamentRegistration.update).toHaveBeenCalledTimes(1);
  });

  it('blocks approval of a legacy duplicate without deleting existing entries', async () => {
    const { players, db } = setup('APPROVAL', [city, { ...city, id: 'pending', status: 'PENDING' }]);
    await expect(players.approveRegistration('admin', 'cup', 'pending')).rejects.toMatchObject({ response: { error: { code: 'ENTRY_NAME_ALREADY_EXISTS' } } });
    expect(db.tournamentRegistration.update).not.toHaveBeenCalled();
  });
});
