import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { weekWindowIst, weeklyVerifiedProgress } from '../apps/web/src/lib/weekly-verified-progress.mjs';

const now = Date.parse('2026-11-12T12:00:00+05:30');

test('Monday to Sunday boundary is calculated in IST, not server UTC', () => {
  const window = weekWindowIst(now);
  assert.equal(new Date(window.start).toISOString(), '2026-11-08T18:30:00.000Z');
  assert.equal(new Date(window.end).toISOString(), '2026-11-15T18:30:00.000Z');
});

test('weekly goals only count unique verified historical matches in the week', () => {
  const history = [
    { id: 'before', confirmedAt: '2026-11-08T23:59:59+05:30', outcome: 'W' },
    { id: 'mon', confirmedAt: '2026-11-09T00:00:00+05:30', outcome: 'W' },
    { id: 'mon', confirmedAt: '2026-11-09T00:00:00+05:30', outcome: 'W' },
    { id: 'thu', confirmedAt: '2026-11-12T09:00:00+05:30', outcome: 'D' },
    { id: 'invalid', confirmedAt: 'not a date', outcome: 'W' },
    { id: 'nextweek', confirmedAt: '2026-11-16T00:00:00+05:30', outcome: 'W' },
  ];
  const result = weeklyVerifiedProgress(history, now);
  assert.equal(result.matches, 2);
  assert.equal(result.wins, 1);
  assert.deepEqual(result.goals.map(goal => [goal.id, goal.value, goal.target]), [
    ['verified-1', 1, 1], ['verified-3', 2, 3], ['win-1', 1, 1],
  ]);
});

test('the activity view never creates claimable rewards or currency', () => {
  const result = weeklyVerifiedProgress([], now);
  assert.deepEqual(result.goals.map(goal => goal.value), [0, 0, 0]);
  assert.equal('coins' in result, false);
  assert.equal('rewards' in result, false);
  assert.equal('xp' in result, false);
});

test('Player Journey exposes read-only, accessible weekly activity without a claim button', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const source = fs.readFileSync(path.join(root, 'apps/web/src/app/experience/page.tsx'), 'utf8');
  assert.match(source, /weeklyVerifiedProgress/);
  assert.match(source, /aria-labelledby="verified-goals-title"/);
  assert.match(source, /<progress aria-label=/);
  assert.match(source, /do not award Arena Coins or XP/);
});
