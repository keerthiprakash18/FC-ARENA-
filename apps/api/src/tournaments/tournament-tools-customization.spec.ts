import { describe, expect, it, vi } from 'vitest';
import { TournamentToolsService } from './tournament-tools.service.js';

describe('tournament organizer customization', () => {
  it('clones an authorized tournament through the existing draft creation flow', async () => {
    const source = {
      id: 'tournament-1',
      leagueId: 'league-1',
      mode: 'SOLO',
      format: 'ROUND_ROBIN',
      competitionFormat: 'LEAGUE_ROUND_ROBIN',
      groupMode: 'SINGLE_GROUP',
      legType: 'SINGLE_LEG',
      fixtureMode: 'AUTOMATIC',
      visibility: 'LEAGUE',
      registrationMode: 'OPEN',
      teamSize: 1,
      maxEntries: 16,
      qualifiersPerGroup: null,
      playoffPairingMethod: 'SEEDED',
      dailyMatchLimit: 4,
      matchesPerParticipantPerDay: 2,
      matchDurationMinutes: 15,
      resultDeadlineHours: 48,
    };
    const createTournament = vi.fn().mockResolvedValue({
      success: true,
      data: { tournament: { id: 'cloned-tournament' } },
      error: null,
    });
    const authorization = { assertCanManageTournament: vi.fn().mockResolvedValue(undefined), assertCanManageTournamentPermission: vi.fn().mockResolvedValue(undefined) };
    const service = new TournamentToolsService(
      { tournament: { findUnique: vi.fn().mockResolvedValue(source) } } as never,
      authorization as never,
      {} as never,
      { createTournament } as never,
    );

    const result = await service.cloneTournament('user-1', 'tournament-1', { name: 'Spring Cup Copy' });

    expect(authorization.assertCanManageTournamentPermission).toHaveBeenCalledWith('user-1', 'tournament-1', 'MANAGE_SETTINGS');
    expect(createTournament).toHaveBeenCalledWith('user-1', 'league-1', expect.objectContaining({
      name: 'Spring Cup Copy',
      mode: 'SOLO',
      format: 'ROUND_ROBIN',
      maxEntries: 16,
    }));
    expect(result.data.tournament.id).toBe('cloned-tournament');
  });
});
