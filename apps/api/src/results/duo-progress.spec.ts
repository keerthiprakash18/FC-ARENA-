import { describe, expect, it } from 'vitest';
import { assertSavedDuoGamesMatch, duoProgressSummary, readDuoProgress, saveDuoGameProgress } from './duo-progress.js';
const tournament = { mode: 'DUO', duoAggregateEnabled: true, duoGamesPerFixture: 4 };
const home = [{ userId: 'h1' }, { userId: 'h2' }], away = [{ userId: 'a1' }, { userId: 'a2' }];
const game = { homePlayerId: 'h1', awayPlayerId: 'a1', homeGoals: 0, awayGoals: 0, expectedVersion: 0 };
const save = (progress = readDuoProgress(null), input = game) => saveDuoGameProgress(tournament, home, away, progress, input);
describe('persisted unfinished Duo games', () => {
  it('saves a zero-zero result without inventing scores for unplayed games', () => {
    const progress = save();
    expect(duoProgressSummary(progress, 4)).toMatchObject({ completedGames: 1, homeScore: 0, awayScore: 0, complete: false });
    expect(readDuoProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress);
    expect(() => assertSavedDuoGamesMatch(progress, [])).toThrow();
  });
  it('repeated writes are idempotent, while stale edits cannot overwrite a saved result', () => {
    const first = save();
    expect(save(first)).toEqual(first);
    expect(() => save(first, { ...game, homeGoals: 3 })).toThrow(/updated elsewhere/);
    const corrected = save(first, { ...game, homeGoals: 3, expectedVersion: 1 });
    expect(corrected.revision).toBe(2);expect(corrected.games).toHaveLength(1);
    expect(corrected.games[0]).toMatchObject({ homeGoals: 3, version: 2 });
    expect(save(corrected, { ...game, homeGoals: 3 })).toEqual(corrected);
  });
  it('merges different games independently and never counts an edited game twice', () => {
    const first = save(undefined, { ...game, homeGoals: 2, awayGoals: 1 });
    const second = save(first, { ...game, awayPlayerId: 'a2', homeGoals: 1 });
    const third = save(second, { ...game, homePlayerId: 'h2', homeGoals: 1, awayGoals: 2 });
    const complete = save(third, { ...game, homePlayerId: 'h2', awayPlayerId: 'a2', awayGoals: 3 });
    expect(duoProgressSummary(complete, 4)).toMatchObject({ completedGames: 4, homeScore: 4, awayScore: 6, complete: true });
    expect(() => assertSavedDuoGamesMatch(complete, [...complete.games].reverse())).not.toThrow();
    expect(() => assertSavedDuoGamesMatch(complete, complete.games.map((item, i) => i ? item : { ...item, homeGoals: 9 }))).toThrow();
  });
  it('keeps the two-game variant one-to-one and rejects opposite-side or unknown players', () => {
    const first = saveDuoGameProgress({ ...tournament, duoGamesPerFixture: 2 }, home, away, readDuoProgress(null), game);
    expect(() => saveDuoGameProgress({ ...tournament, duoGamesPerFixture: 2 }, home, away, first, { ...game, homePlayerId: 'h2' })).toThrow();
    expect(() => save(undefined, { ...game, awayPlayerId: 'h2' })).toThrow();
    expect(() => saveDuoGameProgress({ ...tournament, duoAggregateEnabled: false }, home, away, first, game)).toThrow();
  });
  it.each([-1, 100, 1.5, NaN])('rejects invalid score %s and oversized aggregate totals', value => {
    expect(() => save(undefined, { ...game, homeGoals: value })).toThrow();
    const first = save(undefined, { ...game, homeGoals: 99 });
    expect(() => save(first, { ...game, awayPlayerId: 'a2', homeGoals: 1 })).toThrow(/combined score/);
  });
  it.each([[], { revision: -1, games: [] }, { revision: 0, games: [{}] }])('rejects corrupt saved data rather than silently losing it', value => {
    expect(() => readDuoProgress(value)).toThrow();
  });
});
