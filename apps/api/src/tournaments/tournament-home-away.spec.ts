import { describe, expect, it, vi } from 'vitest';
import { TournamentFixtureWizardService } from './tournament-fixture-wizard.service.js';

const { randomDirection } = vi.hoisted(() => ({ randomDirection: vi.fn<() => number>() }));
vi.mock('node:crypto', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:crypto')>(),
  randomInt: randomDirection,
}));

const ids = (count: number) => Array.from({ length: count }, (_, index) => `team-${index + 1}`);
const service = new TournamentFixtureWizardService({} as never, {} as never);

describe('fixture wizard home/away fairness', () => {
  it.each([
    ['LEAGUE_ROUND_ROBIN', 'SINGLE_LEG', 5],
    ['LEAGUE_ROUND_ROBIN', 'SINGLE_LEG', 8],
    ['DOUBLE_ROUND_ROBIN', 'HOME_AWAY', 8],
    ['ELITE_CUP', 'SINGLE_LEG', 10],
    ['UCL_CUP', 'SINGLE_LEG', 36],
  ] as const)('keeps %s balanced even in random mode', (format, legType, count) => {
    const teams = ids(count);
    const source = service['generateBlueprints'](format, legType, teams);
    const original = structuredClone(source);
    for (const direction of [0, 1]) {
      randomDirection.mockReturnValue(direction);
      const fixtures = service['applyHomeAwayMode'](source, 'RANDOM');
      expect(fixtures.map(fixture => fixture.key)).toEqual(source.map(fixture => fixture.key));
      for (const team of teams) {
        const home = fixtures.filter(fixture => fixture.homeRegistrationId === team);
        const away = fixtures.filter(fixture => fixture.awayRegistrationId === team);
        expect(Math.abs(home.length - away.length)).toBeLessThanOrEqual(1);
        if (format === 'UCL_CUP') {
          for (let pot = 0; pot < 4; pot++) {
            expect(home.filter(fixture => Math.floor(teams.indexOf(fixture.awayRegistrationId!) / 9) === pot)).toHaveLength(1);
            expect(away.filter(fixture => Math.floor(teams.indexOf(fixture.homeRegistrationId!) / 9) === pot)).toHaveLength(1);
          }
        }
      }
      if (legType === 'HOME_AWAY') {
        for (const fixture of fixtures) {
          expect(fixtures.filter(other => other.homeRegistrationId === fixture.awayRegistrationId && other.awayRegistrationId === fixture.homeRegistrationId)).toHaveLength(1);
        }
      }
    }
    expect(source).toEqual(original);
  });

  it('keeps knockout source slots attached to their teams when reversing sides', () => {
    const source = service['generateBlueprints']('SINGLE_ELIMINATION', 'SINGLE_LEG', ids(5));
    randomDirection.mockReturnValue(1);
    const reversed = service['applyHomeAwayMode'](source, 'RANDOM');
    source.forEach((fixture, index) => {
      expect(reversed[index]).toMatchObject({
        homeRegistrationId: fixture.awayRegistrationId,
        awayRegistrationId: fixture.homeRegistrationId,
        homeSourceKey: fixture.awaySourceKey,
        awaySourceKey: fixture.homeSourceKey,
      });
    });
  });
});
