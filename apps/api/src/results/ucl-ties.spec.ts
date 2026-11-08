import { describe, expect, it, vi } from 'vitest';
import { assertUclFirstLegMutable, mirrorUclReturnLeg, resolveAggregateWinner, uclWinner } from './ucl-ties.js';
import { rankUclEntries } from '../tournaments/ucl-ranking.js';

const fixture = { id: 'leg-2', tournamentId: 'cup', phase: 'PLAYOFF', roundNumber: 1,
  roundName: 'UCL KNOCKOUT PLAY-OFF · LEG 2', matchday: 2, bracketPosition: 1,
  homeRegistrationId: 'A', awayRegistrationId: 'B' };

describe('UCL aggregate and penalty outcomes', () => {
  it('advances the aggregate winner even when it loses the return leg', () => {
    expect(resolveAggregateWinner('A', 'B', { homeScore: 2, awayScore: 0 }, { homeScore: 3, awayScore: 0 })).toBe('B');
  });
  it('does not use away goals to decide a tied aggregate', () => {
    expect(() => resolveAggregateWinner('A', 'B', { homeScore: 3, awayScore: 2 }, { homeScore: 1, awayScore: 0 })).toThrow();
    expect(resolveAggregateWinner('A', 'B', { homeScore: 3, awayScore: 2, homePenaltyScore: 4, awayPenaltyScore: 5 }, { homeScore: 1, awayScore: 0 })).toBe('B');
  });
  it('rejects tied or partial penalty scores and penalties without a tied score', () => {
    for (const penalties of [{ homePenaltyScore: 4 }, { homePenaltyScore: 4, awayPenaltyScore: 4 }, { homePenaltyScore: -1, awayPenaltyScore: 4 }]) {
      expect(() => resolveAggregateWinner('A', 'B', { homeScore: 0, awayScore: 0, ...penalties })).toThrow();
    }
    expect(() => resolveAggregateWinner('A', 'B', { homeScore: 1, awayScore: 0, homePenaltyScore: 4, awayPenaltyScore: 5 })).toThrow();
  });
  it('allows a first-leg draw without advancing either side', async () => {
    await expect(uclWinner({}, { ...fixture, matchday: 1 }, { homeScore: 0, awayScore: 0 })).resolves.toBeNull();
  });
  it('requires a confirmed reversed first leg before deciding the return leg', async () => {
    const tx = { fixture: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(uclWinner(tx, fixture, { homeScore: 2, awayScore: 0 })).rejects.toMatchObject({ response: { error: { code: 'FIRST_LEG_NOT_CONFIRMED' } } });
    tx.fixture.findFirst.mockResolvedValue({ homeRegistrationId: 'B', awayRegistrationId: 'A', status: 'COMPLETED', match: { status: 'COMPLETED', confirmedResult: { status: 'CONFIRMED', homeScore: 3, awayScore: 0 } } });
    await expect(uclWinner(tx, fixture, { homeScore: 2, awayScore: 0 })).resolves.toBe('B');
  });
  it('fills the opposite return-leg slot and guards an already started leg', async () => {
    const tx = { fixture: { findFirst: vi.fn().mockResolvedValue({ id: 'return', match: { status: 'UNSCHEDULED' } }), update: vi.fn() } };
    await mirrorUclReturnLeg(tx, { ...fixture, matchday: 1 }, 'HOME', 'A');
    expect(tx.fixture.update).toHaveBeenCalledWith({ where: { id: 'return' }, data: { awayRegistrationId: 'A' } });
    tx.fixture.findFirst.mockResolvedValue({ id: 'return', match: { status: 'LIVE' } });
    await expect(mirrorUclReturnLeg(tx, { ...fixture, matchday: 1 }, 'HOME', 'A')).rejects.toMatchObject({ response: { error: { code: 'DOWNSTREAM_MATCH_LOCKED' } } });
    await expect(assertUclFirstLegMutable(tx, { ...fixture, matchday: 1 })).rejects.toMatchObject({ response: { error: { code: 'UCL_RETURN_LEG_STARTED' } } });
  });
  it('uses away goals ahead of wins and original seed order in league ranking', () => {
    const ranked = rankUclEntries([{ id: 'A', seed: 4 }, { id: 'B', seed: 1 }, { id: 'C', seed: 2 }, { id: 'D', seed: 3 }], [
      { homeId: 'C', awayId: 'A', homeScore: 0, awayScore: 1 }, { homeId: 'B', awayId: 'D', homeScore: 1, awayScore: 0 },
    ]);
    expect(ranked.slice(0, 2).map(entry => entry.id)).toEqual(['A', 'B']);
    expect(ranked.find(entry => entry.id === 'C')?.opponentPoints).toBe(3);
  });
});
