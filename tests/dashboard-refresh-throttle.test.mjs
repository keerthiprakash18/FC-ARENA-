import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dashboard = fs.readFileSync(path.join(root, 'apps/web/src/app/dashboard/page.tsx'), 'utf8');

test('dashboard revalidation avoids redundant background and offline requests', () => {
  assert.match(dashboard, /const minimumGapMs = 15_000/);
  assert.match(dashboard, /current - lastRefreshAt < minimumGapMs/);
  assert.match(dashboard, /navigator\.onLine === false/);
  assert.match(dashboard, /document\.visibilityState === 'hidden'/);
  assert.match(dashboard, /window\.setInterval\(refresh, 60_000\)/);
  assert.match(dashboard, /removeEventListener\('visibilitychange', refresh\)/);
});
