import { describe, expect, it, vi } from 'vitest';
import { TournamentEntriesService } from './tournament-entries.service.js';

function setup(fixtureCount = 0) {
  const entry = {
    id: 'entry-1',
    tournamentId: 'tournament-1',
    registeredByUserId: 'captain-1',
    status: 'APPROVED',
    members: [{ userId: 'captain-1' }],
  };
  const tx = {
    tournamentRegistration: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: entry.id, entryName: 'Updated Team' }),
    },
  };
  const prisma = {
    tournament: { findUnique: vi.fn().mockResolvedValue({ id: 'tournament-1', leagueId: 'league-1', status: 'REGISTRATION_OPEN', teamSize: 1 }) },
    tournamentRegistration: { findUnique: vi.fn().mockResolvedValue(entry) },
    fixture: { count: vi.fn().mockResolvedValue(fixtureCount) },
    $transactionWithRetry: vi.fn(async (work: any) => work(tx)),
  };
  const authorization = { assertCanManageTournamentPermission: vi.fn() };
  return { prisma, tx, authorization, service: new TournamentEntriesService(prisma as never, authorization as never) };
}

describe('Tournament entry self-edit authorization', () => {
  it('allows the registering captain to edit the team before fixtures exist', async () => {
    const setupState = setup();

    await expect(setupState.service.updateEntry('captain-1', 'tournament-1', 'entry-1', { entryName: 'Updated Team' })).resolves.toMatchObject({ success: true });
    expect(setupState.authorization.assertCanManageTournamentPermission).not.toHaveBeenCalled();
    expect(setupState.tx.tournamentRegistration.update).toHaveBeenCalled();
  });

  it('requires tournament participant-management permission for non-captains', async () => {
    const setupState = setup();
    setupState.authorization.assertCanManageTournamentPermission.mockRejectedValue(new Error('forbidden'));

    await expect(setupState.service.updateEntry('other-user', 'tournament-1', 'entry-1', { entryName: 'Updated Team' })).rejects.toThrow('forbidden');
    expect(setupState.tx.tournamentRegistration.update).not.toHaveBeenCalled();
  });

  it('locks captain edits after fixtures are generated', async () => {
    const setupState = setup(1);

    await expect(setupState.service.updateEntry('captain-1', 'tournament-1', 'entry-1', { entryName: 'Updated Team' })).rejects.toMatchObject({ response: { error: { code: 'TOURNAMENT_TEAMS_HAVE_FIXTURES' } } });
    expect(setupState.tx.tournamentRegistration.update).not.toHaveBeenCalled();
  });
});
