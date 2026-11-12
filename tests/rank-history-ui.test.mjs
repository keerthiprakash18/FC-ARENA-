import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(root, 'apps/web/src/app/leaderboards/page.tsx'), 'utf8');

test('personal ranking timeline is accessible and intentionally sparse', () => {
  assert.match(page, /rankings\/history/);
  assert.match(page, /aria-labelledby="my-ranking-history-title"/);
  assert.match(page, /rankHistory\.history\.slice\(-14\)/);
  assert.match(page, /point\.position === null \? '—'/);
  assert.match(page, /Missing dates and unranked days are never estimated/);
});
test('historical ranks are fetched for the authenticated player and selected league/mode only', () => {
  assert.match(page, /if \(!selectedLeague \|\| !userId\)/);
  assert.match(page, /const controller = new AbortController\(\)/);
  assert.match(page, /\{ signal: controller\.signal \}/);
  assert.match(page, /return \(\) => controller\.abort\(\)/);
});
