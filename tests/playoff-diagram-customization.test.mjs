import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { seededOpeningPairs } from '../apps/web/src/lib/playoff-flow-data.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = p => fs.readFileSync(path.join(root, p), 'utf8');

test('sample seeded diagrams mirror supported top-4/8/16 opening seed order', () => {
  assert.deepEqual(seededOpeningPairs(4), [[1, 4], [2, 3]]);
  assert.deepEqual(seededOpeningPairs(8), [[1, 8], [4, 5], [2, 7], [3, 6]]);
  assert.equal(seededOpeningPairs(16).length, 8);
  assert.deepEqual(seededOpeningPairs(16)[0], [1, 16]);
  assert.deepEqual(seededOpeningPairs(16)[1], [8, 9]);
  assert.deepEqual(seededOpeningPairs(10), []);
});

test('visual flow replaces three text cards and keeps actual results separate', () => {
  const wrapper = source('apps/web/src/components/tournaments/saved-playoff-explanation.tsx');
  const chart = source('apps/web/src/components/tournaments/playoff-flow-diagram.tsx');
  assert.match(wrapper, /<PlayoffFlowDiagram/);
  assert.doesNotMatch(wrapper, /01 · QUALIFY|02 · PLAYOFF RULE|03 · THE CHAMPION/);
  assert.match(chart, /Format illustration · not live fixtures/);
  assert.match(chart, /DoubleChanceFlow/);
  assert.match(chart, /Second chance/);
  assert.match(chart, /Final/);
  assert.match(chart, /overflow-x-auto/);
  assert.match(chart, /tabIndex=\{0\}/);
  assert.match(chart, /seededOpeningPairs/);
});

test('admin edit is shown on Playoff Center only before a bracket exists', () => {
  const page = source('apps/web/src/app/tournaments/[tournamentId]/playoffs/page.tsx');
  const form = source('apps/web/src/components/tournaments/league-playoff-setup.tsx');
  const controller = source('apps/api/src/tournaments/tournaments.controller.ts');
  const service = source('apps/api/src/tournaments/playoffs.service.ts');
  assert.match(page, /canEditPlayoffSettings/);
  assert.match(page, /playoffFixtures\.length === 0/);
  assert.match(page, /canManageSettings && tournament\.canManageFixtures/);
  assert.match(page, /mode="edit"/);
  assert.match(page, /Playoff format locked/);
  assert.match(form, /Save Playoff Changes/);
  assert.match(form, /playoffs\/league-settings/);
  assert.match(controller, /@Patch\('tournaments\/:tournamentId\/playoffs\/league-settings'\)/);
  assert.match(service, /async reconfigureLeaguePlayoffs/);
  assert.match(service, /existingPlayoffs !== 0/);
  assert.match(service, /'MANAGE_SETTINGS'/);
  assert.match(service, /'MANAGE_FIXTURES'/);
  assert.match(service, /action: 'PLAYOFF_FORMAT_UPDATED'/);
});
