const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const catalog = JSON.parse(fs.readFileSync('apps/web/src/data/football-teams.json', 'utf8'));
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/src/lib/football-catalog.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: out });

test('all 50 league rosters have unique, usable club names and a reviewable source', () => {
  assert.equal(catalog.leagues.length, 50);
  assert.equal(new Set(catalog.leagues.map(l => l.id)).size, 50);
  for (const league of catalog.leagues) {
    assert.ok(league.country && league.season);
    assert.equal(new URL(league.source).hostname, 'site.api.espn.com');
    assert.ok(league.clubs.length >= 8, league.id);
    const names = league.clubs.map(name => name.normalize('NFKC').trim().toLowerCase());
    assert.equal(new Set(names).size, names.length);
    for (const name of league.clubs) {
      assert.ok(name.trim() === name && name.length <= 120);
      assert.doesNotMatch(name, /\b(TBD|TBA|To Be Determined)\b|\uFFFD|[\x00-\x1f]/i);
    }
  }
});

test('national choices cover all 211 FIFA associations including football territories and home nations', () => {
  assert.equal(catalog.nationalTeams.length, 211);
  assert.equal(new Set(catalog.nationalTeams.map(t => t.id)).size, 211);
  for (const id of ['IND', 'BEL', 'ENG', 'SCO', 'WAL', 'NIR', 'KOS', 'GIB', 'CUW', 'TAH']) {
    assert.ok(catalog.nationalTeams.some(t => t.id === id), id);
  }
  assert.ok(catalog.nationalTeams.every(t => ['AFC', 'CAF', 'Concacaf', 'CONCACAF', 'CONMEBOL', 'OFC', 'UEFA'].includes(t.confederation)));
});

test('selecting Bundesliga cannot mix La Liga clubs into its options', () => {
  const german = out.footballTeamOptions(catalog, 'CLUB', 'ger.1', '');
  assert.ok(german.some(t => t.name === 'Bayern Munich'));
  assert.ok(!german.some(t => t.name === 'Real Madrid'));
  assert.equal(out.footballTeamOptions(catalog, 'CLUB', 'esp.1', 'Real Madrid').length, 1);
  assert.equal(out.footballTeamOptions(catalog, 'CLUB', 'ger.1', 'Real Madrid').length, 0);
});

test('club and country search handles accents, multiple words and common country aliases', () => {
  assert.ok(out.footballTeamOptions(catalog, 'CLUB', 'esp.1', 'atletico').some(t => /Atlético/.test(t.name)));
  assert.ok(out.footballTeamOptions(catalog, 'CLUB', '', 'manchester england').length >= 2);
  assert.equal(out.footballTeamOptions(catalog, 'NATIONAL', '', 'South Korea')[0].id, 'KOR');
  assert.equal(out.footballTeamOptions(catalog, 'NATIONAL', '', 'Belgium')[0].id, 'BEL');
  assert.equal(out.footballTeamOptions(catalog, 'NATIONAL', '', 'Bayern').length, 0);
});
