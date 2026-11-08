const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const memberships = [
  { membershipType: 'PRIMARY', league: { id: 'tamil' } },
  { membershipType: 'SECONDARY', league: { id: 'kickoff' } },
];
function fixture({ blocked = false, persistent = new Map() } = {}) {
  const values = new Map(), effects = [], out = {};
  const storage = {
    getItem(key) { if (blocked) throw Error('Storage unavailable'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw Error('Storage unavailable'); values.set(key, value); },
  };
  const react = {
    useCallback: fn => fn, useEffect: fn => effects.push(fn),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  };
  const code = ts.transpileModule(fs.readFileSync('apps/web/src/lib/active-league.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports: out, require: () => react, sessionStorage: storage,
    localStorage: { getItem(key) { if (blocked) throw Error('Storage unavailable'); return persistent.get(key) ?? null; }, setItem(key, value) { if (blocked) throw Error('Storage unavailable'); persistent.set(key, value); } }, Event,
    window: { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} },
  });
  return { out, values, effects, persistent };
}

test('league selection follows an account across pages and stays separate from another account', () => {
  const { out } = fixture();
  out.useActiveLeague('one', memberships)[1]('kickoff');
  assert.equal(out.useActiveLeague('one', memberships)[0], 'kickoff');
  assert.equal(out.useActiveLeague('two', memberships)[0], 'tamil');
  assert.equal(out.useActiveLeague('one', memberships)[0], 'kickoff');
});

test('removed memberships and foreign URL selections fall back to an accessible league', () => {
  const { out } = fixture();
  out.useActiveLeague('one', memberships)[1]('kickoff');
  assert.equal(out.useActiveLeague('one', memberships.slice(0, 1), 'foreign')[0], 'tamil');
  out.useActiveLeague('one', memberships)[1]('foreign');
  assert.equal(out.useActiveLeague('one', memberships)[0], 'kickoff');
  assert.equal(out.useActiveLeague('one', [])[0], '');
});

test('a valid tournament URL becomes the selection for subsequent navigation', () => {
  const { out, effects, values } = fixture();
  values.set('fc-arena:tournament-league:one', 'tamil');
  assert.equal(out.useActiveLeague('one', memberships, 'kickoff')[0], 'kickoff');
  effects.splice(0).forEach(effect => effect());
  assert.equal(out.useActiveLeague('one', memberships)[0], 'kickoff');
});

test('blocked browser storage still preserves navigation context in memory', () => {
  const { out } = fixture({ blocked: true });
  out.useActiveLeague('one', memberships)[1]('kickoff');
  assert.equal(out.useActiveLeague('one', memberships)[0], 'kickoff');
  assert.equal(out.useActiveLeague('two', memberships)[0], 'tamil');
});

test('a new app session restores the account league even when session storage and module memory are gone', () => {
  const first = fixture(); first.out.useActiveLeague('one', memberships)[1]('kickoff');
  const restarted = fixture({ persistent: first.persistent });
  assert.equal(restarted.out.useActiveLeague('one', memberships)[0], 'kickoff');
  assert.equal(restarted.out.useActiveLeague('two', memberships)[0], 'tamil');
});

test('a valid legacy Cup selection migrates to persistent storage without requiring another selection', () => {
  const first = fixture(); first.values.set('fc-arena:tournament-league:one', 'kickoff');
  assert.equal(first.out.useActiveLeague('one', memberships)[0], 'kickoff');
  first.effects.splice(0).forEach(effect => effect());
  assert.equal(fixture({ persistent: first.persistent }).out.useActiveLeague('one', memberships)[0], 'kickoff');
});
