import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('AI messages label provider and built-in fallback', () => {
  const page = source('apps/web/src/app/ai/page.tsx');
  assert.match(page, /engine: 'PROVIDER' \| 'LOCAL_FALLBACK'/);
  assert.match(page, /Built-in help · Read-only/);
  assert.match(page, /AI provider · Read-only/);
  assert.doesNotMatch(page, /[\u0B80-\u0BFF]/u);
});

test('League leaderboard explains accurate scoring order and visible rule summary', () => {
  const page = source('apps/web/src/app/leaderboards/page.tsx');
  assert.match(page, /Only confirmed Tournament results count/);
  assert.match(page, /Performance Points = 3 for a win \+ 1 for a draw/);
  assert.match(page, /goal difference, goals scored/);
  assert.match(page, /<details className=/);
});

test('Phone push quiet hours are explicit, opt-in and distinguish inbox from push', () => {
  const page = source('apps/web/src/app/settings/notifications/page.tsx');
  const push = source('apps/api/src/notifications/push.service.ts');
  assert.match(page, /quietHoursEnabled/);
  assert.match(page, /quietHoursStartHour/);
  assert.match(page, /quietHoursEndHour/);
  assert.match(page, /India Standard Time/);
  assert.match(push, /isQuietHoursActive\(quietHours, new Date\(\)\)/);
  assert.match(push, /if \(!urgent && isQuietHoursActive/);
});

test('verified XP mission and milestone views are automatic and reversible', () => {
  const policy = source('apps/api/src/experience/experience-policy.ts');
  const page = source('apps/web/src/components/experience/player-journey.tsx');
  assert.match(policy, /PLAYER_MILESTONES/);
  assert.match(policy, /milestones: PLAYER_MILESTONES\.map/);
  assert.match(page, /Matchday Milestones/);
  assert.match(page, /unique confirmed matches/);
  assert.match(page, /Bonuses are applied automatically after results are verified/);
});
test('official team honours are scoped and archived, never copied into individual player awards', () => {
  const api = source('apps/api/src/achievements/achievements.service.ts');
  const summary = source('apps/web/src/app/tournaments/[tournamentId]/summary/page.tsx');
  assert.match(api, /calculateTeamHonours\(completedMatches/);
  assert.match(api, /teamHonours: officialTeamHonours/);
  assert.match(summary, /Official DUO \/ TEAM Trophy Archive/);
  assert.match(summary, /summary\.teamHonours/);
});
test('production retention audit is explicitly read only', () => {
  const script = source('ops/vcl-release-retention-audit.sh');
  assert.match(script, /RELEASE_RETENTION_AUDIT=PASS READ_ONLY/);
  assert.match(script, /fcarena-prod/);
  assert.doesNotMatch(script, /\brm\s+-rf\b|\brmdir\s|\bfind\b[^\n]+-delete\b/);
});
