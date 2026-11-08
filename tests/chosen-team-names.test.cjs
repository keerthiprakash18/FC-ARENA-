const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const load = path => {
  const out = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: out, require: () => load('apps/web/src/lib/entry-name.ts') });
  return out;
};
const { chosenTeamNames } = load('apps/web/src/lib/chosen-team-names.ts');

test('approved and pending countries, clubs and custom names are reserved alike', () => {
  const names = chosenTeamNames([
    { id: 'a', status: 'APPROVED', entryName: 'Belgium' },
    { id: 'b', status: 'PENDING', entryName: 'Bayern Munich' },
    { id: 'c', status: 'PENDING', entryName: 'Our Custom Team' },
  ]);
  for (const name of ['belgium', 'bayern munich', 'our custom team']) assert.ok(names.has(name));
});
test('case, repeated spaces and compatibility Unicode cannot create separate choices', () => {
  const names = chosenTeamNames([{ id: 'a', status: 'APPROVED', entryName: '  ＢＡＹＥＲＮ\u00a0  Munich ' }]);
  assert.equal(names.size, 1); assert.ok(names.has('bayern munich'));
});
test('rejected, withdrawn and empty legacy registrations do not reserve a name', () => {
  const names = chosenTeamNames(['REJECTED', 'WITHDRAWN'].map((status, i) => ({ id: String(i), status, entryName: 'Belgium' }))
    .concat([{ id: 'blank', status: 'APPROVED', entryName: null }]));
  assert.equal(names.size, 0);
});
test('editing excludes only the current entry and still blocks a different entry with the same name', () => {
  const entries = [{ id: 'mine', status: 'PENDING', entryName: 'Belgium' }, { id: 'other', status: 'APPROVED', entryName: 'Liverpool' }];
  assert.ok(!chosenTeamNames(entries, 'mine').has('belgium'));
  assert.ok(chosenTeamNames(entries, 'mine').has('liverpool'));
  assert.ok(chosenTeamNames([...entries, { id: 'legacy', status: 'APPROVED', entryName: 'BELGIUM' }], 'mine').has('belgium'));
});
