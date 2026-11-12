import { describe, expect, it } from 'vitest';
import { buildUniversalPlayoffPlan, type UniversalPlayoffBlueprint } from './universal-playoff-engine.js';
import { buildUclPlayoffPlan } from './ucl-engine.js';
import { BRACKET_CARD, buildPlayoffBracket, layoutPlayoffBracket } from '../../../web/src/lib/playoff-bracket.js';

function renderPlan(plan: { fixtures: UniversalPlayoffBlueprint[] }) {
  const entry = (id: string | null) => id ? { id, entryName: id, entryLogoUrl: null, members: [] } : null;
  const fixtures = plan.fixtures.map((blueprint, sequence) => ({
    id: blueprint.key, fixtureCode: blueprint.key, sequence, roundNumber: blueprint.roundNumber, roundName: blueprint.roundName,
    bracketPosition: blueprint.bracketPosition, phase: 'PLAYOFF' as const, matchday: 'matchday' in blueprint ? blueprint.matchday as number | null : null,
    home: entry(blueprint.homeRegistrationId), away: entry(blueprint.awayRegistrationId),
    homeSource: blueprint.homeSource ? { id: blueprint.homeSource.key, fixtureCode: blueprint.homeSource.key, outcome: blueprint.homeSource.outcome } : null,
    awaySource: blueprint.awaySource ? { id: blueprint.awaySource.key, fixtureCode: blueprint.awaySource.key, outcome: blueprint.awaySource.outcome } : null,
    match: null, group: null, status: 'UNSCHEDULED', scheduledAt: null, venue: null,
  }));
  return layoutPlayoffBracket(buildPlayoffBracket(fixtures));
}

describe('Published bracket layout follows the actual playoff generator', () => {
  for (const format of ['GLOBAL_SEEDED', 'PROTECTED_SEED', 'DOUBLE_CHANCE', 'UCL_CUP'] as const) {
    it.each([2, 3, 6, 10, 16, 22, 36, 64])(`${format}: preserves every tie, source and nonoverlapping position for %i entries`, count => {
      if (format === 'DOUBLE_CHANCE' && count === 2) return;
      const seeds = Array.from({ length: count }, (_, i) => `entry-${i}`);
      const plan = format === 'UCL_CUP' ? buildUclPlayoffPlan(seeds) : buildUniversalPlayoffPlan(format, seeds);
      const graph = renderPlan(plan);
      expect(graph.nodes.reduce((sum, node) => sum + node.fixtures.length, 0)).toBe(plan.fixtures.length);
      expect(graph.edges.length).toBe(plan.fixtures.reduce((sum, fixture) => sum + Number(Boolean(fixture.homeSource)) + Number(Boolean(fixture.awaySource)), 0));
      expect(graph.finalId).toBeTruthy();
      for (const node of graph.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0); expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.x + BRACKET_CARD.width).toBeLessThanOrEqual(graph.width);
        expect(node.y + BRACKET_CARD.height).toBeLessThanOrEqual(graph.height);
        for (const other of graph.nodes.filter(other => other.id !== node.id)) {
          expect(node.x + BRACKET_CARD.width <= other.x || other.x + BRACKET_CARD.width <= node.x ||
            node.y + BRACKET_CARD.height <= other.y || other.y + BRACKET_CARD.height <= node.y).toBe(true);
        }
      }
    });
  }
});
