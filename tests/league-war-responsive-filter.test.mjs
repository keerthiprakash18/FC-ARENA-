import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warPage = fs.readFileSync(
  path.join(root, 'apps/web/src/app/league-war/page.tsx'),
  'utf8',
);

test('League War status filters remain readable and scrollable on narrow Android screens', () => {
  assert.match(warPage, /aria-label="Filter League Wars by status"/);
  assert.match(warPage, /overflow-x-auto overscroll-x-contain/);
  assert.match(warPage, /min-w-max/);
  assert.match(warPage, /whitespace-nowrap/);
  assert.match(warPage, /min-h-11/);
  assert.match(warPage, /aria-pressed=\{filter === value\}/);
});

test('League War status filters use the shared club theme and keyboard focus design', () => {
  for (const token of [
    '--theme-primary',
    '--theme-on-primary',
    '--theme-surface',
    '--theme-text-secondary',
    '--theme-border',
    '--theme-focus',
  ]) {
    assert.ok(warPage.includes(token), `Missing design token: ${token}`);
  }
  assert.match(warPage, /focus-visible:outline-offset-2/);
});

test('League War status filters retain the original supported states', () => {
  for (const status of ["'ALL'", "'LIVE'", "'PENDING'", "'COMPLETED'"]) {
    assert.ok(warPage.includes(status), `Missing filter status: ${status}`);
  }
  assert.match(warPage, /setFilter\(/);
});
