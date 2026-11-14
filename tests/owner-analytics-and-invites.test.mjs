import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('owner dashboard reports honestly scoped operational ratios, never false retention', () => {
  const page = source('apps/web/src/app/admin/analytics/page.tsx');
  assert.match(page, /Competition quality · operational ratios/);
  assert.match(page, /not player retention or acquisition metrics/);
  assert.match(page, /data\.totals\.completedMatches \+ data\.totals\.liveMatches \+ data\.totals\.scheduledMatches > 0/);
  assert.match(page, /data\.totals\.completedMatches > 0/);
  assert.match(page, /'—'/);
});

test('admin invite link opens normal membership preview, never auto-approves', () => {
  const page = source('apps/web/src/app/community/invitations/page.tsx');
  const join = source('apps/web/src/app/leagues/page.tsx');
  assert.match(page, /const url = new URL\('\/leagues', window\.location\.origin\)/);
  assert.match(page, /url\.searchParams\.set\('invite', data\.token\)/);
  assert.match(page, /membership\.adminRole/);
  assert.match(page, /Copy 7-day invite link/);
  assert.match(join, /new URLSearchParams\(window\.location\.search\)\.get\("code"\)/);
  assert.match(join, /\/leagues\/join/);
});
