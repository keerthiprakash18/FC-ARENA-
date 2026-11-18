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

const playoffs = fs.readFileSync(path.join(root, 'apps/web/src/app/tournaments/[tournamentId]/playoffs/page.tsx'), 'utf8');
const groups = fs.readFileSync(path.join(root, 'apps/web/src/app/tournaments/[tournamentId]/groups/page.tsx'), 'utf8');
const fixturePage = fs.readFileSync(path.join(root, 'apps/web/src/app/tournaments/[tournamentId]/fixtures/page.tsx'), 'utf8');
const awards = fs.readFileSync(path.join(root, 'apps/web/src/app/awards/page.tsx'), 'utf8');

test('round-robin league does not offer a false playoff generation action', () => {
  assert.match(playoffs, /function includesPlayoffStage\(competitionFormat: string\)/);
  assert.match(playoffs, /if \(!includesPlayoffStage\(tournament\.competitionFormat\)\)/);
  assert.match(playoffs, /if \(!hasKnockoutStage\)/);
  assert.match(playoffs, /historical playoff fixture\(s\) exist for this league-only format/);
  assert.match(playoffs, /!includesPlayoffStage\(tournament\.competitionFormat\)/);
  assert.match(playoffs, /No playoff bracket for this league/);
  assert.match(playoffs, /View league standings/);
  assert.match(playoffs, /format\.title,/);
});

test('single-table tournaments do not report a false group balancing problem', () => {
  assert.match(groups, /editor\.tournament\.groupMode === 'MULTIPLE_GROUPS'/);
  assert.match(groups, /Single-table competition/);
  assert.match(groups, /Separate groups and group balancing are not configured/);
  assert.match(groups, /View official standings/);
  assert.match(groups, /if \(editor\.tournament\.groupMode !== 'MULTIPLE_GROUPS'\)/);
  assert.match(groups, /title="Single-table League"/);
  assert.match(groups, /This is a read-only roster/);
  assert.match(groups, /No separate groups in this competition/);
});

test('unqualified Ballon contenders are never displayed as rank zero', () => {
  assert.match(awards, /const qualifiedLeader =/);
  assert.match(awards, /Top Qualifying Player/);
  assert.match(awards, /No player has qualified for an official position yet/);
  assert.match(awards, /row\.eligible && row\.position > 0 \? `#\$\{row\.position\}` : '—'/);
});

test('league-only fixtures use table terminology without a misleading group filter', () => {
  assert.match(fixturePage, /const isLeagueTable =/);
  assert.match(fixturePage, /\{!isLeagueTable \? <>/);
  assert.match(fixturePage, /isLeagueTable \? 'Format' : 'Groups'/);
  assert.match(fixturePage, /isLeagueTable \? 'League' : \(groups\.length \|\| 1\)/);
  assert.match(fixturePage, /isLeagueTable \? 'League matchdays' : 'Competition Group'/);
});
