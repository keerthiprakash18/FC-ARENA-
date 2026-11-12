import { generateEliteCupSchedule, type EliteCupSchedule } from './elite-cup-engine.js';
import { buildSeededBracketPlan, type PlayoffSourceRef, type UniversalPlayoffBlueprint, type UniversalPlayoffPlan } from './universal-playoff-engine.js';

// A validated eight-round draw template for four seed pots of nine. Every
// team faces two different opponents per pot, once home and once away.
// Entry seed order supplies the teams; RANDOMIZED mode shuffles that order.
const DRAW: number[][][] = [
  [[27,21],[25,30],[6,12],[29,16],[15,20],[5,33],[8,3],[22,9],[2,23],[31,19],[28,14],[13,26],[4,34],[17,24],[11,35],[1,32],[10,0],[18,7]],
  [[31,7],[3,1],[10,15],[5,8],[4,19],[23,13],[6,20],[24,28],[25,33],[27,2],[16,22],[11,18],[30,21],[9,12],[17,0],[32,26],[35,29],[14,34]],
  [[0,34],[30,1],[13,5],[14,18],[25,8],[21,4],[22,32],[2,16],[6,15],[24,29],[7,26],[31,9],[35,28],[17,20],[3,19],[33,12],[10,11],[23,27]],
  [[20,5],[35,0],[18,8],[22,31],[6,28],[21,3],[25,15],[24,2],[19,11],[26,23],[14,9],[1,17],[10,32],[34,27],[16,13],[33,30],[7,4],[12,29]],
  [[0,22],[18,21],[20,25],[24,1],[19,23],[6,30],[26,9],[34,32],[29,4],[10,33],[35,2],[5,28],[7,11],[3,14],[12,8],[16,17],[31,15],[13,27]],
  [[31,32],[0,7],[6,2],[3,33],[30,13],[29,28],[27,15],[8,10],[17,12],[9,4],[11,34],[23,14],[5,26],[1,25],[16,24],[21,20],[35,18],[22,19]],
  [[21,10],[12,25],[24,22],[17,30],[8,29],[31,33],[27,3],[19,35],[20,28],[18,26],[34,23],[32,16],[9,1],[7,13],[6,5],[0,4],[15,2],[14,11]],
  [[22,6],[2,1],[25,24],[7,32],[8,31],[21,12],[0,23],[13,15],[19,10],[27,30],[28,9],[17,35],[3,11],[16,4],[14,5],[33,26],[20,29],[18,34]],
];

/** Orient closed cycles so every vertex has equal home/away degree. */
function orient(pairs: number[][]): Array<[number, number]> {
  const edges = pairs.map(pair => [...pair]);
  const vertices = new Set(edges.flat());
  const odd = [...vertices].filter(vertex => edges.filter(edge => edge.includes(vertex)).length % 2);
  const dummy = Math.max(...vertices) + 1;
  for (const vertex of odd) edges.push([vertex, dummy]);
  const remaining = new Set(edges.map((_, index) => index));
  const result: Array<[number, number]> = [];
  while (remaining.size) {
    let vertex = edges[remaining.values().next().value!][0];
    for (;;) {
      const index = [...remaining].find(value => edges[value].includes(vertex));
      if (index === undefined) break;
      remaining.delete(index);
      const next = edges[index][0] === vertex ? edges[index][1] : edges[index][0];
      if (index < pairs.length) result[index] = [vertex, next];
      vertex = next;
    }
  }
  return result;
}

export function generateUclLeaguePhase(ids: string[]): EliteCupSchedule {
  const base = generateEliteCupSchedule(ids, Math.min(8, Math.max(1, ids.length - 1)));
  if (ids.length !== 36) {
    const directions = orient(base.fixtures.map(fixture => [ids.indexOf(fixture.homeRegistrationId), ids.indexOf(fixture.awayRegistrationId)]));
    base.fixtures.forEach((fixture, index) => {
      const [home, away] = directions[index];
      fixture.homeTeamId = fixture.homeRegistrationId = ids[home];
      fixture.awayTeamId = fixture.awayRegistrationId = ids[away];
    });
    return base;
  }
  const pairings = DRAW.flat();
  const directions = new Map<number, [number, number]>();
  for (let first = 0; first < 4; first++) for (let second = first; second < 4; second++) {
    const indices = pairings.map((pair, index) => ({ pair, index })).filter(({ pair }) => {
      const pots = pair.map(value => Math.floor(value / 9)).sort((a, b) => a - b);
      return pots[0] === first && pots[1] === second;
    });
    orient(indices.map(({ pair }) => pair)).forEach((pair, index) => directions.set(indices[index].index, pair));
  }
  return { ...base, matchdays: 8, fixtures: pairings.map((_, index) => {
    const [home, away] = directions.get(index)!;
    const matchday = Math.floor(index / 18) + 1;
    return {
      key: `ucl-md-${matchday}-${index % 18 + 1}`, roundNumber: matchday,
      roundName: `MATCHDAY ${matchday}`, matchday, bracketPosition: index % 18 + 1,
      homeTeamId: ids[home], awayTeamId: ids[away], homeRegistrationId: ids[home], awayRegistrationId: ids[away],
    };
  }) };
}

export function uclQualification(teamCount: number) {
  if (!Number.isInteger(teamCount) || teamCount < 2) throw new Error('UCL requires at least two teams.');
  const knockoutSize = 2 ** Math.floor(Math.log2(Math.max(2, Math.min(16, Math.floor(teamCount * 2 / 3)))));
  const qualifiers = Math.min(teamCount, knockoutSize * 1.5);
  return { qualifiers, direct: 2 * knockoutSize - qualifiers, knockoutSize };
}

export interface UclPlayoffBlueprint extends UniversalPlayoffBlueprint {
  // In the PLAYOFF phase matchday records the leg, while STAGE uses matchdays.
  matchday: 1 | 2 | null;
}

export function buildUclPlayoffPlan(rankedIds: string[], teamCount = rankedIds.length): Omit<UniversalPlayoffPlan, 'fixtures'> & { fixtures: UclPlayoffBlueprint[] } {
  const config = uclQualification(teamCount);
  const seeds = rankedIds.slice(0, config.qualifiers);
  if (seeds.length !== config.qualifiers || new Set(seeds).size !== seeds.length) throw new Error('UCL qualification requires unique ranked entries.');
  const fixtures: UclPlayoffBlueprint[] = [];
  type Entrant = { id: string | null; source: PlayoffSourceRef | null };
  const entry = (id: string): Entrant => ({ id, source: null });
  function tie(key: string, round: number, label: string, position: number, seeded: Entrant, opponent: Entrant, final = false): Entrant {
    if (final) {
      fixtures.push({ key, roundNumber: round, roundName: 'UCL FINAL', bracketPosition: position, matchday: null,
        homeRegistrationId: seeded.id, awayRegistrationId: opponent.id, homeSource: seeded.source, awaySource: opponent.source });
      return { id: null, source: { key, outcome: 'WINNER' } };
    }
    const firstKey = `${key}-leg-1`, secondKey = `${key}-leg-2`;
    fixtures.push({ key: firstKey, roundNumber: round, roundName: `UCL ${label} · LEG 1`, bracketPosition: position, matchday: 1,
      homeRegistrationId: opponent.id, awayRegistrationId: seeded.id, homeSource: opponent.source, awaySource: seeded.source });
    fixtures.push({ key: secondKey, roundNumber: round, roundName: `UCL ${label} · LEG 2`, bracketPosition: position, matchday: 2,
      homeRegistrationId: seeded.id, awayRegistrationId: opponent.id, homeSource: null, awaySource: null });
    return { id: null, source: { key: secondKey, outcome: 'WINNER' } };
  }
  const slots = new Map<string, Entrant>();
  for (let index = 0; index < config.direct; index++) slots.set(`seed-${index + 1}`, entry(seeds[index]));
  for (let index = config.direct; index < config.knockoutSize; index++) {
    slots.set(`seed-${index + 1}`, tie(`ucl-playoff-${index - config.direct + 1}`, 1, 'KNOCKOUT PLAY-OFF', index - config.direct + 1,
      entry(seeds[index]), entry(seeds[config.qualifiers - 1 - (index - config.direct)])));
  }
  const order = buildSeededBracketPlan(Array.from({ length: config.knockoutSize }, (_, index) => `seed-${index + 1}`)).bracketSlots;
  let entrants = order.map(key => slots.get(key!)!);
  let round = config.qualifiers > config.direct ? 2 : 1;
  while (entrants.length > 1) {
    const label = entrants.length === 16 ? 'ROUND OF 16' : entrants.length === 8 ? 'QUARTER-FINAL' : entrants.length === 4 ? 'SEMI-FINAL' : 'FINAL';
    const next: Entrant[] = [];
    for (let index = 0; index < entrants.length; index += 2) next.push(tie(`ucl-round-${round}-${index / 2 + 1}`, round, label, index / 2 + 1,
      entrants[index], entrants[index + 1], entrants.length === 2));
    entrants = next;
    round++;
  }
  return { format: 'PROTECTED_SEED', fixtures, seedOrder: seeds, bracketSize: config.knockoutSize,
    byeCount: config.direct, playInMatches: config.qualifiers - config.knockoutSize, eliteSeeds: seeds.slice(0, config.direct), secondChanceMatches: 0 };
}
