import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTournamentFormatDiagram, layoutTournamentFormatDiagram } from '../apps/web/src/lib/tournament-format-diagram.ts';

function guide(overrides = {}, qualification = {}) {
  return { title: 'UCL Cup', competitionFormat: 'UCL_CUP', playoffFormat: 'UCL_TWO_LEG', approvedEntries: 22, entryLabel: 'players', groupCount: 0, matchesPerEntry: 8, provisional: true,
    qualification: { state: 'READY', source: 'OVERALL_STANDINGS', total: 12, direct: 4, playIn: 8, eliminated: 10, perGroup: null, description: 'Saved rules', bands: [{ from: 1, to: 4 }] }, ...overrides,
    ...{ qualification: { state: 'READY', source: 'OVERALL_STANDINGS', total: 12, direct: 4, playIn: 8, eliminated: 10, perGroup: null, description: 'Saved rules', bands: [{ from: 1, to: 4 }], ...qualification } } };
}
function node(model, id) { return model.nodes.find(n => n.id === id); }

test('22-entry UCL shows direct, playoff and eliminated routes merging into an eight-entry quarter-final field', () => {
  const model = buildTournamentFormatDiagram(guide());
  assert.equal(node(model, 'direct').value, 4); assert.equal(node(model, 'playoff').value, 8); assert.equal(node(model, 'eliminated').value, 10);
  assert.equal(node(model, 'round-8').value, 8); assert.equal(node(model, 'round-4').value, 4); assert.equal(node(model, 'round-2').value, 2);
  assert.deepEqual(model.edges.filter(e => e.to === 'round-8').map(e => e.from), ['direct', 'playoff']);
  assert.equal(model.edges.filter(e => e.from === 'eliminated').length, 0);
  assert.match(node(model, 'round-2').detail.join(' '), /One-match final/);
});

test('36-entry UCL shows 16 knockout places after eight direct entries and eight playoff winners', () => {
  const model = buildTournamentFormatDiagram(guide({ approvedEntries: 36 }, { total: 24, direct: 8, playIn: 16, eliminated: 12 }));
  assert.equal(node(model, 'round-16').value, 16); assert.equal(node(model, 'champion').value, 1);
});

test('a two-entry UCL begins at the final without a nonexistent playoff route', () => {
  const model = buildTournamentFormatDiagram(guide({ approvedEntries: 2 }, { total: 2, direct: 2, playIn: 0, eliminated: 0 }));
  assert.equal(node(model, 'round-2').value, 2); assert.equal(node(model, 'playoff'), undefined); assert.equal(node(model, 'eliminated'), undefined);
});

test('group qualification shows group counts and actual total rather than an assumed top-two cutoff', () => {
  const model = buildTournamentFormatDiagram(guide({ competitionFormat: 'GROUP_STAGE_KNOCKOUT', playoffFormat: 'PROTECTED_SEED', groupCount: 3, approvedEntries: 12 }, { source: 'GROUP_QUALIFIERS', total: 9, perGroup: 3, eliminated: 3 }));
  assert.equal(node(model, 'qualifiers').value, 9); assert.match(node(model, 'qualifiers').detail.join(' '), /Top 3 from each group/);
  assert.equal(node(model, 'round-16').value, 9); assert.match(node(model, 'round-16').detail.join(' '), /16 bracket slots/);
});

test('six protected seeds remain six entries in an eight-slot bracket and byes are not drawn as players', () => {
  const model = buildTournamentFormatDiagram(guide({ competitionFormat: 'ELITE_CUP', playoffFormat: 'PROTECTED_SEED' }, { total: 6, eliminated: 16 }));
  assert.equal(node(model, 'round-8').value, 6); assert.equal(node(model, 'round-4').value, 4); assert.match(node(model, 'round-8').detail.join(' '), /Byes/);
});

test('double chance includes the losing higher-seed route and lower-route survivors', () => {
  const model = buildTournamentFormatDiagram(guide({ competitionFormat: 'ELITE_CUP', playoffFormat: 'DOUBLE_CHANCE', approvedEntries: 16 }, { total: 16, eliminated: 0 }));
  assert.equal(node(model, 'seeded-route').value, 4); assert.equal(node(model, 'lower-route').value, 12); assert.equal(node(model, 'second-chance').value, 4);
  assert(model.edges.some(e => e.from === 'seeded-route' && e.to === 'second-chance' && e.secondChance));
  assert.deepEqual(model.edges.filter(e => e.to === 'round-4').map(e => e.from), ['seeded-route', 'second-chance']);
});

test('three-entry double chance gives one lower entry a route into the second-chance tie', () => {
  const model = buildTournamentFormatDiagram(guide({ competitionFormat: 'ELITE_CUP', playoffFormat: 'DOUBLE_CHANCE', approvedEntries: 3 }, { total: 3, eliminated: 0 }));
  assert.equal(node(model, 'lower-route').value, 1); assert.equal(node(model, 'second-chance').value, 2); assert.equal(node(model, 'round-4'), undefined); assert.equal(node(model, 'round-2').value, 2);
});

test('pending rules, a league without playoffs, and custom formats do not get a fictional knockout path', () => {
  for (const state of ['PENDING', 'NONE']) {
    const model = buildTournamentFormatDiagram(guide({ competitionFormat: 'LEAGUE_ROUND_ROBIN', playoffFormat: null }, { state, total: null, eliminated: null }));
    assert.equal(model.nodes.filter(n => n.id.startsWith('round-')).length, 0);
    assert.equal(node(model, 'qualifiers'), undefined);
  }
  const custom = buildTournamentFormatDiagram(guide({ competitionFormat: 'CUSTOM_MANUAL', playoffFormat: null }, { state: 'NONE', total: null }));
  assert.equal(node(custom, 'champion'), undefined); assert(node(custom, 'custom'));
});

test('manual or random seed selection does not label the overall top places as qualified', () => {
  const model = buildTournamentFormatDiagram(guide({ competitionFormat: 'ELITE_CUP', playoffFormat: 'GLOBAL_SEEDED' }, { bands: [] }));
  assert.match(node(model, 'qualifiers').detail.join(' '), /saved seeding rules/);
  assert.doesNotMatch(node(model, 'eliminated').detail.join(' '), /Places 13/);
});

test('older metadata keeps the bracket general instead of assuming single elimination', () => {
  const model = buildTournamentFormatDiagram(guide({ competitionFormat: 'ELITE_CUP', playoffFormat: undefined }));
  assert(node(model, 'bracket')); assert.equal(model.nodes.filter(n => n.id.startsWith('round-')).length, 0);
});

test('both diagram orientations keep nodes in bounds and every connector joins existing stages', () => {
  for (const model of [buildTournamentFormatDiagram(guide()), buildTournamentFormatDiagram(guide({ competitionFormat: 'ELITE_CUP', playoffFormat: 'DOUBLE_CHANCE' }))]) {
    for (const landscape of [false, true]) {
      const layout = layoutTournamentFormatDiagram(model, landscape);
      for (const n of layout.nodes) { assert(n.x >= 0 && n.y >= 0); assert(n.x + layout.nodeWidth <= layout.width); assert(n.y + layout.nodeHeight <= layout.height); }
      for (const edge of layout.edges) { assert(layout.nodes.some(n => n.id === edge.from)); assert(layout.nodes.some(n => n.id === edge.to)); assert.doesNotMatch(edge.path, /NaN|undefined/); }
    }
  }
});
