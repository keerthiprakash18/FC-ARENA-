const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8') + '\nexport { fixtureStatus, fixtureKind, fixtureIsRelevant, isFutureScheduledFixture, isUnscheduledFixture };';
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const api = {};
vm.runInNewContext(code, { exports: api, require: () => ({}), Set, Map, Date });
const now = Date.parse('2026-10-28T12:00:00Z');
const fixture = { status: 'SCHEDULED', scheduledAt: '2026-10-27T08:00:00Z', sequence: 1, match: { status: 'SCHEDULED' } };

test('an overdue unplayed fixture remains visible as pending', () => {
  assert.equal(api.fixtureIsRelevant(fixture), true);
  assert.equal(api.fixtureKind(fixture, now), 'PENDING');
});
test('generated fixtures without kickoff dates stay visible', () => {
  assert.equal(api.isUnscheduledFixture({ ...fixture, status: 'UNSCHEDULED', scheduledAt: null }), true);
});
test('postponement wins over a stale scheduled match status', () => {
  const postponed = { ...fixture, status: 'POSTPONED', scheduledAt: '2026-10-29T12:00:00Z' };
  assert.equal(api.fixtureStatus(postponed), 'POSTPONED');
  assert.equal(api.isFutureScheduledFixture(postponed, now), false);
});
test('completed fixtures cannot be promoted by a stale live match status', () => {
  assert.equal(api.fixtureIsRelevant({ ...fixture, status: 'COMPLETED', match: { status: 'LIVE' } }), false);
});
