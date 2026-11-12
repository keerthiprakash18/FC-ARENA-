import { describe, expect, it } from 'vitest';
import { coversSingleRoundRobin, rankBestThirdGroups } from './best-third-playoffs.js';
import { buildUniversalPlayoffPlan } from './universal-playoff-engine.js';

const entries = Array.from({ length: 42 }, (_, index) => ({
  id: String(index), groupId: String(Math.floor(index / 6)),
}));
const stage = entries.flatMap((home, index) => entries.slice(index + 1)
  .filter(away => away.groupId === home.groupId)
  .map(away => ({
    groupId: home.groupId, homeRegistrationId: home.id, awayRegistrationId: away.id,
    homeId: home.id, awayId: away.id, homeScore: 1, awayScore: 0,
  })));

describe('seven-group Round of 16', () => {
  it('adds exactly two third-place entries to the 14 automatic qualifiers', () => {
    // Three points and GD remain tied for these wins. Goals scored separate the teams.
    const results = stage.map(result => ['8:9', '14:15'].includes(`${result.homeId}:${result.awayId}`)
      ? { ...result, homeScore: 3, awayScore: 2 }
      : result);
    const ranked = rankBestThirdGroups('tournament', entries, results, new Map());
    const automatic = [...ranked.groups.values()].flatMap(group => group.slice(0, 2).map(entry => entry.id));
    const bestThird = ranked.thirdPlace.slice(0, 2).map(entry => entry.id);
    expect(automatic).toHaveLength(14);
    expect(new Set(bestThird)).toEqual(new Set(['8', '14']));

    const plan = buildUniversalPlayoffPlan('GLOBAL_SEEDED', [...automatic, ...bestThird]);
    expect(plan.byeCount).toBe(0);
    expect(plan.fixtures).toHaveLength(15);
    const opening = plan.fixtures.filter(fixture => fixture.roundNumber === 1);
    expect(opening).toHaveLength(8);
    expect(new Set(opening.flatMap(fixture => [fixture.homeRegistrationId, fixture.awayRegistrationId])))
      .toEqual(new Set([...automatic, ...bestThird]));
    expect(opening.every(fixture => fixture.roundName === 'ROUND OF 16')).toBe(true);
  });

  it('requires the complete set of same-group fixtures, including one fixture per pair', () => {
    expect(coversSingleRoundRobin(entries, stage)).toBe(true);
    expect(coversSingleRoundRobin(entries, stage.slice(1))).toBe(false);
    expect(coversSingleRoundRobin(entries, [stage[0], ...stage.slice(0, -1)])).toBe(false);
  });

  it('uses fair play at the third-place cutoff when points, GD and goals scored are equal', () => {
    const fairPlay = new Map([['14', 2], ['20', 1]]);
    expect(rankBestThirdGroups('tournament', entries, stage, fairPlay).thirdPlace
      .slice(0, 2).map(entry => entry.id)).toEqual(['14', '20']);
  });
});
