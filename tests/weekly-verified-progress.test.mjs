import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { weekWindowIst, weeklyVerifiedProgress, weeklyActivityProgress } from '../apps/web/src/lib/weekly-verified-progress.mjs';

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

test('server totals take precedence over capped or corrected history', () => {
  const week = { startsAt: '2026-11-08T18:30:00.000Z', endsAt: '2026-11-15T18:30:00.000Z', verifiedMatches: 120, verifiedWins: 73 };
  const result = weeklyActivityProgress(week, [], now);
  assert.equal(result.source, 'canonical');
  assert.equal(result.matches, 120);
  assert.equal(result.wins, 73);
  assert.deepEqual(result.goals.map(goal => goal.value), [1, 3, 1]);
  const zero = weeklyActivityProgress({ ...week, verifiedMatches: 0, verifiedWins: 0 }, [{ id: 'old', confirmedAt: '2026-11-12T09:00:00+05:30', outcome: 'W' }], now);
  assert.equal(zero.source, 'canonical');
  assert.equal(zero.matches, 0);
  assert.equal(zero.wins, 0);
});

test('old and malformed API responses use an explicitly limited fallback', () => {
  const history = [{ id: 'one', confirmedAt: '2026-11-12T09:00:00+05:30', outcome: 'W' }];
  const week = { startsAt: '2026-11-08T18:30:00.000Z', endsAt: '2026-11-15T18:30:00.000Z', verifiedMatches: 1 };
  for (const old of [undefined, week, { ...week, verifiedWins: 2 }, { ...week, verifiedWins: 1, startsAt: 'invalid' }]) {
    const result = weeklyActivityProgress(old, history, now);
    assert.equal(result.source, 'recent-history');
    assert.equal(result.matches, 1);
    assert.equal(result.wins, 1);
  }
});

test('Player Journey exposes read-only, accessible weekly activity without a claim button', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const page = fs.readFileSync(path.join(root, 'apps/web/src/app/experience/page.tsx'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'apps/web/src/components/experience/player-journey.tsx'), 'utf8');
  assert.match(page, /weeklyHistory=\{career.matchHistory/);
  assert.match(source, /weeklyActivityProgress\(data\?\.week, weeklyHistory\)/);
  assert.match(source, /Recent history estimate/);
  assert.match(source, /aria-labelledby="verified-goals-title"/);
  assert.match(source, /<progress aria-label=/);
  assert.match(source, /do not award Arena Coins or XP/);
});
