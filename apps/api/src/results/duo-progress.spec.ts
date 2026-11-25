import { describe, expect, it } from 'vitest';
import { assertSavedDuoGamesMatch, duoProgressSummary, duoFixturePlan, duoReplacementAliases, readDuoProgress, saveDuoGameProgress, validateDuoFixtureResult } from './duo-progress.js';
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
  const change = (from: string, to: string) => ({ beforeData: { userId: from }, afterData: { userId: to } });
  it('uses the replacement in pending slots, keeps historical scores, rejects new games for the outgoing player', () => {
    const first = save(undefined, { ...game, homeGoals: 2, awayGoals: 1 });
    const second = save(first, { ...game, awayPlayerId: 'a2', homeGoals: 1 });
    const third = save(second, { ...game, homePlayerId: 'h2', awayPlayerId: 'a2', awayGoals: 2 });
    // Existing three games include the outgoing player; the remaining slot belongs to the replacement.
    const changedAway = [{ userId: 'replacement' }, { userId: 'a2' }];
    const aliases = { home: new Map<string, string>(), away: duoReplacementAliases(changedAway, [change('a1', 'replacement')], ['a1']) };
    const plan = duoFixturePlan(third, home, changedAway, 4, aliases);
    expect(plan.away.map(m => m.userId)).toEqual(['a2', 'replacement']);
    expect(plan.pairings).toContainEqual({ homePlayerId: 'h2', awayPlayerId: 'replacement' });
    expect(plan.pairings).not.toContainEqual({ homePlayerId: 'h2', awayPlayerId: 'a1' });
    expect(() => saveDuoGameProgress(tournament, home, changedAway, third, { ...game, homePlayerId: 'h2' }, aliases)).toThrow();
    const fourth = saveDuoGameProgress(tournament, home, changedAway, third, { ...game, homePlayerId: 'h2', awayPlayerId: 'replacement', homeGoals: 3 }, aliases);
    expect(fourth.games.slice(0, 3)).toEqual(third.games);
    expect(fourth.games[3]).toMatchObject({ homePlayerId: 'h2', awayPlayerId: 'replacement' });
    expect(duoProgressSummary(fourth, 4)).toMatchObject({ completedGames: 4, homeScore: 6, awayScore: 3, complete: true });
    const verified = validateDuoFixtureResult(tournament, home, changedAway, { ...duoProgressSummary(fourth, 4), duoGames: fourth.games }, fourth, aliases);
    expect(verified?.map(g => g.awayPlayerId)).toEqual(['a1','a2','a2','replacement']);
    expect(() => validateDuoFixtureResult(tournament, home, changedAway, { ...duoProgressSummary(fourth, 4), duoGames: fourth.games.map(g => ({ ...g, awayPlayerId: g.awayPlayerId === 'a1' ? 'replacement' : g.awayPlayerId })) }, fourth, aliases)).toThrow();
  });
  it('handles legacy progress, chained replacements, and replacements on both sides', () => {
    const games = [{ ...game, version: 1 }];
    const legacy = readDuoProgress({ revision: 1, games });
    const currentHome = [{userId:'h-new'}, {userId:'h2'}];
    const currentAway = [{userId:'a-new'}, {userId:'a2'}];
    const aliases = { home: duoReplacementAliases(currentHome, [change('h1','h-mid'),change('h-mid','h-new')], ['h1']),
      away: duoReplacementAliases(currentAway, [change('a1','a-new')], ['a1']) };
    const plan = duoFixturePlan(legacy, currentHome, currentAway, 4, aliases);
    expect(plan.pairings).toContainEqual({homePlayerId:'h1',awayPlayerId:'a1'});
    expect(plan.pairings).toContainEqual({homePlayerId:'h-new',awayPlayerId:'a2'});
    expect(plan.pairings).toContainEqual({homePlayerId:'h2',awayPlayerId:'a-new'});
    expect(plan.pairings).not.toContainEqual({homePlayerId:'h-new',awayPlayerId:'a-new'});
    expect(() => duoFixturePlan(legacy, currentHome, currentAway, 4)).toThrow(/saved scores are unchanged/);
  });
  it('keeps a saved two-game pairing and assigns the unplayed game to current players', () => {
    const two = { ...tournament, duoGamesPerFixture: 2 };
    const first = saveDuoGameProgress(two, home, away, readDuoProgress(null), { ...game, awayPlayerId:'a2' });
    const changedAway = [{userId:'replacement'},{userId:'a2'}];
    const second = saveDuoGameProgress(two, home, changedAway, first, {...game,homePlayerId:'h2',awayPlayerId:'replacement'});
    expect(second.games[0]).toEqual(first.games[0]);
    expect(second.games[1]).toMatchObject({homePlayerId:'h2',awayPlayerId:'replacement'});
    expect(validateDuoFixtureResult(two,home,changedAway,{...duoProgressSummary(second,2),duoGames:second.games},second)).toHaveLength(2);
  });
  it('fails closed if replacement history is missing or two old games map to the same slot', () => {
    expect(() => duoReplacementAliases(away, [], ['departed'])).toThrow(/saved scores are unchanged/);
    const games = ['old', 'a1'].map(awayPlayerId => ({ ...game, awayPlayerId, version: 1 }));
    const aliases = { home: new Map<string,string>(), away: duoReplacementAliases(away, [change('old','a1')], ['old']) };
    expect(() => duoFixturePlan({ revision: 2, games }, home, away, 4, aliases)).toThrow(/saved scores are unchanged/);
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
