import assert from 'node:assert/strict';
import test from 'node:test';
import { BRACKET_CARD, buildPlayoffBracket, layoutPlayoffBracket } from '../apps/web/src/lib/playoff-bracket.ts';

const entry = id => ({ id, entryName: id, entryLogoUrl: null, members: [] });
const source = (id, outcome = 'WINNER') => ({ id, fixtureCode: id, outcome });
function fixture(id, round, position = 1, extra = {}) {
  return { id, fixtureCode: id, phase: 'PLAYOFF', roundNumber: round, roundName: `Round ${round}`, bracketPosition: position,
    sequence: round, matchday: null, status: 'UNSCHEDULED', home: entry('A'), away: entry('B'), homeSource: null, awaySource: null,
    scheduledAt: null, venue: null, group: null, match: { id: `match-${id}`, status: 'UNSCHEDULED', matchCode: id, confirmedResult: null }, ...extra };
}
function result(homeScore, awayScore, extra = {}) { return { status: 'COMPLETED', match: { status: 'COMPLETED', confirmedResult: { homeScore, awayScore, status: 'CONFIRMED', ...extra } } }; }

test('UCL legs form one tie and the aggregate and penalties follow first-leg team orientation', () => {
  const first = fixture('leg1', 1, 1, { roundName: 'UCL QUARTER-FINAL · LEG 1', matchday: 1, ...result(2, 1) });
  const second = fixture('leg2', 1, 1, { roundName: 'UCL QUARTER-FINAL · LEG 2', matchday: 2, home: entry('B'), away: entry('A'), ...result(3, 2, { homePenaltyScore: 4, awayPenaltyScore: 5 }) });
  const model = buildPlayoffBracket([second, first]);
  assert.equal(model.ties.length, 1); assert.deepEqual(model.ties[0].score, { home: 4, away: 4 });
  assert.deepEqual(model.ties[0].penalties, { home: 5, away: 4 }); assert.equal(model.ties[0].winnerId, 'A');
  assert.equal(model.ties[0].complete, true); assert.equal(model.ties[0].locked, false);
});

test('unverified, reversed and mismatched legs cannot display a verified aggregate winner', () => {
  const first = fixture('leg1', 1, 1, { roundName: 'UCL ROUND OF 16 · LEG 1', matchday: 1, ...result(3, 0) });
  const second = fixture('leg2', 1, 1, { roundName: 'UCL ROUND OF 16 · LEG 2', matchday: 2, home: entry('B'), away: entry('A'), ...result(0, 0) });
  for (const bad of [{ ...first, status: 'SCHEDULED' }, { ...first, match: { ...first.match, confirmedResult: { ...first.match.confirmedResult, status: 'REVERSED' } } }, { ...first, away: entry('C') }]) {
    const tie = buildPlayoffBracket([bad, second]).ties[0];
    assert.equal(tie.complete, false); assert.equal(tie.winnerId, null); assert.equal(tie.locked, true);
  }
  const pending = buildPlayoffBracket([first, { ...second, status: 'SCHEDULED' }]).ties[0];
  assert.deepEqual(pending.score, { home: 3, away: 0 }); assert.equal(pending.winnerId, null); assert.equal(pending.locked, false);
});

test('return-leg sources connect to the combined tie and one-match finals stay separate', () => {
  const first = fixture('leg1', 1, 1, { roundName: 'UCL SEMI-FINAL · LEG 1', matchday: 1 });
  const second = fixture('leg2', 1, 1, { roundName: 'UCL SEMI-FINAL · LEG 2', matchday: 2 });
  const final = fixture('final', 2, 1, { roundName: 'UCL FINAL', homeSource: source('leg2') });
  const model = buildPlayoffBracket([first, second, final]);
  assert.equal(model.ties.length, 2); assert.equal(model.ties[1].twoLegged, false);
  assert.deepEqual(model.edges, [{ from: 'tie-1-1', to: 'final', slot: 'HOME', outcome: 'WINNER' }]);
});

test('round labels and duplicate bracket positions do not merge double-chance matches', () => {
  const fixtures = [fixture('qualifier', 1, 1), fixture('elimination', 1, 1),
    fixture('second-chance', 2, 1, { homeSource: source('qualifier', 'LOSER'), awaySource: source('elimination') }),
    fixture('final', 3, 1, { homeSource: source('qualifier'), awaySource: source('second-chance') })];
  const graph = layoutPlayoffBracket(buildPlayoffBracket(fixtures));
  assert.equal(graph.nodes.length, 4); assert.equal(graph.mirrored, false);
  assert(graph.edges.some(edge => edge.from === 'qualifier' && edge.to === 'second-chance' && edge.outcome === 'LOSER'));
});

test('single elimination mirrors both branches into the final with no overlapping cards', () => {
  const fixtures = [fixture('a', 1, 1), fixture('b', 1, 2), fixture('c', 1, 3), fixture('d', 1, 4),
    fixture('semi1', 2, 1, { homeSource: source('a'), awaySource: source('b') }),
    fixture('semi2', 2, 2, { homeSource: source('c'), awaySource: source('d') }),
    fixture('final', 3, 1, { homeSource: source('semi1'), awaySource: source('semi2') })];
  const graph = layoutPlayoffBracket(buildPlayoffBracket(fixtures));
  assert.equal(graph.mirrored, true); assert.equal(graph.nodes.length, 7);
  const final = graph.nodes.find(node => node.id === 'final');
  assert(graph.nodes.find(node => node.id === 'semi1').x < final.x);
  assert(graph.nodes.find(node => node.id === 'semi2').x > final.x);
  for (const node of graph.nodes) {
    assert(node.x >= 0 && node.y >= 0 && node.x + BRACKET_CARD.width <= graph.width && node.y + BRACKET_CARD.height <= graph.height);
    for (const other of graph.nodes.filter(other => other.id !== node.id)) assert(node.x + BRACKET_CARD.width <= other.x || other.x + BRACKET_CARD.width <= node.x || node.y + BRACKET_CARD.height <= other.y || other.y + BRACKET_CARD.height <= node.y);
  }
});

test('byes and a two-entry tournament render their real fixtures without invented matches', () => {
  const graph = layoutPlayoffBracket(buildPlayoffBracket([fixture('playin', 1), fixture('final', 2, 1, { homeSource: source('playin') })]));
  assert.equal(graph.nodes.length, 2);
  const single = layoutPlayoffBracket(buildPlayoffBracket([fixture('final', 1, 1, { ...result(1, 0) })]));
  assert.equal(single.nodes.length, 1); assert.equal(single.finalId, 'final'); assert.equal(single.nodes[0].winnerId, 'A');
  assert.equal(layoutPlayoffBracket(buildPlayoffBracket([])).nodes.length, 0);
});
