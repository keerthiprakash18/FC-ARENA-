import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseDuoGames, validateDuoAggregate } from './duo-aggregate.js';

const activeDuo = { mode: 'DUO', duoAggregateEnabled: true };
const legacyDuo = { mode: 'DUO', duoAggregateEnabled: false };
const home = [{ userId: 'h1' }, { userId: 'h2' }];
const away = [{ userId: 'a1' }, { userId: 'a2' }];
const games = [
  { homePlayerId: 'h1', awayPlayerId: 'a1', homeGoals: 2, awayGoals: 1 },
  { homePlayerId: 'h2', awayPlayerId: 'a2', homeGoals: 0, awayGoals: 3 },
];
const scores = { homeScore: 2, awayScore: 4, duoGames: games };

describe('Duo individual-game aggregation', () => {
  it('accepts exactly two games and sums the goals for both sides', () => {
    expect(validateDuoAggregate(activeDuo, home, away, scores)).toEqual(games);
    expect(scores.duoGames.reduce((total, game) => total + game.homeGoals, 0)).toBe(2);
    expect(scores.duoGames.reduce((total, game) => total + game.awayGoals, 0)).toBe(4);
  });

  it('rejects aggregated score tampering', () => {
    expect(() => validateDuoAggregate(activeDuo, home, away, { ...scores, homeScore: 7 }))
      .toThrow(BadRequestException);
  });

  it('rejects missing individual games or an unfilled pair', () => {
    expect(() => validateDuoAggregate(activeDuo, home, away, { homeScore: 2, awayScore: 4 }))
      .toThrow(BadRequestException);
    expect(() => validateDuoAggregate(activeDuo, home, away, { ...scores, duoGames: games.slice(0, 1) }))
      .toThrow(BadRequestException);
  });

  it('rejects duplicated players and players from other sides or leagues', () => {
    expect(() => validateDuoAggregate(activeDuo, home, away, { ...scores,
      duoGames: [games[0], { ...games[1], homePlayerId: 'h1' }] })).toThrow(BadRequestException);
    expect(() => validateDuoAggregate(activeDuo, home, away, { ...scores,
      duoGames: [games[0], { ...games[1], awayPlayerId: 'outsider' }] })).toThrow(BadRequestException);
    expect(() => validateDuoAggregate(activeDuo, home, [{ userId: 'a1' }], scores)).toThrow(BadRequestException);
  });

  it('rejects invalid, negative, noninteger, and overflow game scores', () => {
    for (const goals of [-1, 100, 1.5, Number.NaN]) {
      expect(() => validateDuoAggregate(activeDuo, home, away, {
        ...scores, duoGames: [games[0], { ...games[1], awayGoals: goals }],
      })).toThrow(BadRequestException);
    }
    expect(parseDuoGames({ homeGoals: 2 })).toBeUndefined();
  });

  it('preserves legacy Duo and SOLO result behavior unless the rule is enabled', () => {
    expect(validateDuoAggregate(legacyDuo, home, away, { homeScore: 3, awayScore: 2 })).toBeUndefined();
    expect(() => validateDuoAggregate(legacyDuo, home, away, scores)).toThrow(BadRequestException);
    expect(() => validateDuoAggregate({ mode: 'SOLO', duoAggregateEnabled: true }, home, away, scores))
      .toThrow(BadRequestException);
  });
});
