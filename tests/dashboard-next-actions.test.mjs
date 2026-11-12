import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = fs.readFileSync(path.join(project, 'apps/web/src/app/dashboard/page.tsx'), 'utf8');

test('home actions depend on actual player, role, fixtures and admin approvals', () => {
  assert.match(file, /const nextActions = \[/);
  assert.match(file, /!hasProfile/);
  assert.match(file, /!selectedMembership/);
  assert.match(file, /\.\.\.\(nextFixture \?/);
  assert.match(file, /isLeagueAdmin && activeTournament/);
  assert.match(file, /pendingEntries/);
  assert.match(file, /\.slice\(0, 3\)/);
});
test('home next-action panel is accessible and never submits results', () => {
  assert.match(file, /aria-labelledby="dashboard-actions-title"/);
  assert.match(file, /id="dashboard-actions-title"/);
  assert.match(file, /nextActions\.map/);
  assert.match(file, /href=\{action\.href\}/);
  assert.match(file, /focus-visible:outline-2/);
});
