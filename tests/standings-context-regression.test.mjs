import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(root, 'apps/web/src/app/tournaments/[tournamentId]/standings/page.tsx'), 'utf8');
const scoring = fs.readFileSync(path.join(root, 'apps/api/src/results/result-outcome.ts'), 'utf8');

test('personal player stats are clearly separate from official tournament standings', () => {
  assert.match(page, /aria-labelledby="my-player-stats-heading"/);
  assert.match(page, /id="my-player-stats-heading"[^>]*>My Player Statistics</);
  assert.match(page, /aria-label="Your personal competition statistics"/);
  assert.match(page, /individual match statistics/);
  assert.match(page, /Team totals in the official standings below may differ/);
  assert.match(page, /tournament\.mode === 'DUO' \|\| tournament\.mode === 'TEAM'/);
  assert.match(page, /eyebrow = 'Official Tournament Standings'/);
  assert.equal((page.match(/eyebrow="Official Tournament Standings"/g) ?? []).length, 2);
});

test('standings explicitly explain GD, points, and ranking without changing scoring', () => {
  assert.match(page, /Points determine rank first\. GD = GF/);
  assert.match(page, /Win = 3 pts, draw = 1, loss = 0/);
  assert.match(page, /title="Goal difference = goals for minus goals against"/);
  assert.match(page, /title="Points: win 3, draw 1, loss 0"/);
  assert.match(scoring, /goalDifference: goalsFor - goalsAgainst/);
  assert.match(scoring, /points: outcome === 'W' \? 3 : outcome === 'D' \? 1 : 0/);
});
