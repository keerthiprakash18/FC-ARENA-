import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { isRoundRobinLeague, hasKnockoutStage, isSingleTableDisplay, showReadOnlyGroupRoster } from '../apps/web/src/lib/tournament-ui-context.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(root, 'apps/web/src/app/tournaments/[tournamentId]/standings/page.tsx'), 'utf8');
const scoring = fs.readFileSync(path.join(root, 'apps/api/src/results/result-outcome.ts'), 'utf8');

test('personal player stats are clearly separate from official tournament standings', () => {
  assert.match(page, /aria-labelledby="my-player-stats-heading"/);
  assert.match(page, /id="my-player-stats-heading"[^>]*>My Player Statistics</);
  assert.match(page, /aria-label="Your personal competition statistics"/);
  assert.match(page, /individual match statistics/);
  assert.match(page, /Team totals in the official standings above may differ/);
  assert.match(page, /tournament\.mode === 'DUO' \|\| tournament\.mode === 'TEAM'/);
  assert.match(page, /eyebrow = 'Official Tournament Standings'/);
  assert.equal((page.match(/eyebrow="Official Tournament Standings"/g) ?? []).length, 2);
});

test('standings explicitly explain GD, points, and ranking without changing scoring', () => {
  assert.match(page, /Official standings · sorted by points \(PTS\)/);
  assert.match(page, /Win 3 · Draw 1 · Loss 0/);
  assert.match(page, /title="Goal difference = goals for minus goals against"/);
  assert.match(page, /title="Points: win 3, draw 1, loss 0"/);
  assert.match(scoring, /goalDifference: goalsFor - goalsAgainst/);
  assert.match(scoring, /points: outcome === 'W' \? 3 : outcome === 'D' \? 1 : 0/);
});

const playoffs = fs.readFileSync(path.join(root, 'apps/web/src/app/tournaments/[tournamentId]/playoffs/page.tsx'), 'utf8');
const groups = fs.readFileSync(path.join(root, 'apps/web/src/app/tournaments/[tournamentId]/groups/page.tsx'), 'utf8');
const tournamentOverview = fs.readFileSync(path.join(root, 'apps/web/src/app/tournaments/[tournamentId]/page.tsx'), 'utf8');
const fixturePage = fs.readFileSync(path.join(root, 'apps/web/src/app/tournaments/[tournamentId]/fixtures/page.tsx'), 'utf8');
const awards = fs.readFileSync(path.join(root, 'apps/web/src/app/awards/page.tsx'), 'utf8');
const nav = fs.readFileSync(path.join(root, 'apps/web/src/components/tournaments/tournament-navigation.tsx'), 'utf8');

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
  assert.match(groups, /const showReadOnlyRoster = showReadOnlyGroupRoster\(/);
  assert.match(groups, /title="Single-table competition"/);
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
  assert.match(fixturePage, /isRoundRobinLeague\(tournament\?\.competitionFormat\)/);
  assert.match(fixturePage, /\{!isLeagueTable \? <>/);
  assert.match(fixturePage, /isLeagueTable \? 'Format' : 'Groups'/);
  assert.match(fixturePage, /isLeagueTable \? 'League' : \(groups\.length \|\| 1\)/);
  assert.match(fixturePage, /isLeagueTable \? 'League matchdays' : 'Competition Group'/);
});

test('tournament overview puts format and match progress above optional management tools', () => {
  assert.match(tournamentOverview, /<TournamentFormatOverview/);
  assert.match(tournamentOverview, /Competition tools · Poster, registration, team management/);
  assert.match(tournamentOverview, /label="Completed Fixtures"/);
  assert.doesNotMatch(tournamentOverview, /aria-label="Competition destinations"/);
  assert.doesNotMatch(tournamentOverview, /label=\{isSingleTable \? "League table" : "Groups"\}/);
});

test('legacy 20-team round-robin with zero actual groups is one table even when groupMode is MULTIPLE_GROUPS', () => {
  assert.equal(isRoundRobinLeague('LEAGUE_ROUND_ROBIN'), true);
  assert.equal(isSingleTableDisplay('LEAGUE_ROUND_ROBIN', 'MULTIPLE_GROUPS', 0), true);
  assert.equal(showReadOnlyGroupRoster('MULTIPLE_GROUPS', 0, false), true);
  assert.equal(hasKnockoutStage('LEAGUE_ROUND_ROBIN'), false);

  // A genuinely configured 7-group stage must retain its editor and filters.
  assert.equal(isSingleTableDisplay('LEAGUE_ROUND_ROBIN', 'MULTIPLE_GROUPS', 7), false);
  assert.equal(showReadOnlyGroupRoster('MULTIPLE_GROUPS', 7, true), false);
  assert.equal(hasKnockoutStage('GROUP_STAGE_KNOCKOUT'), true);
  assert.equal(showReadOnlyGroupRoster('MULTIPLE_GROUPS', 0, true), false);
});

test('tournament navigation is compact, role-aware, and refreshes on playoff setting changes', () => {
  assert.match(nav, /label !== 'Groups' \|\| !current \|\| current\.groupCount > 0/);
  assert.match(nav, /label !== 'Bracket' \|\| !current \|\| isKnockoutFormat/);
  assert.match(nav, /label !== 'Settings' \|\| !current \|\| current\.canManageSettings/);
  assert.match(nav, /fcarena:tournament-updated/);
  assert.match(nav, /More tournament sections/);
  assert.doesNotMatch(nav, /\['Registration', '\/registration'\],\s*\['Teams', '\/teams'\],\s*\['Groups', '\/groups'\],\s*\['Fixtures', '\/fixtures'\]/);
});

const formatOverview = fs.readFileSync(path.join(root, 'apps/web/src/components/tournaments/tournament-format-overview.tsx'), 'utf8');
const leaguePlayoffSetup = fs.readFileSync(path.join(root, 'apps/web/src/components/tournaments/league-playoff-setup.tsx'), 'utf8');

test('tournament format and playoff format are explicit on Overview, not repeated on Fixtures', () => {
  assert.match(tournamentOverview, /<TournamentFormatOverview/);
  assert.match(formatOverview, /Tournament Format/);
  assert.match(formatOverview, /Playoff Format/);
  assert.match(formatOverview, /No Playoffs — League Winner/);
  assert.match(formatOverview, /Single-Table League \+ Playoffs/);
  assert.match(formatOverview, /Final league standings → top/);
  assert.doesNotMatch(fixturePage, /<TournamentFormatGuide/);
});

test('league champion rule changes only after explicit admin bracket and qualifier choice', () => {
  assert.match(tournamentOverview, /<LeaguePlayoffSetup/);
  assert.match(tournamentOverview, /tournament\.canManageSettings && tournament\.canManageFixtures/);
  assert.match(leaguePlayoffSetup, /value="PROTECTED_SEED"/);
  assert.match(leaguePlayoffSetup, /playoffQualifiersTotal: total/);
  assert.match(leaguePlayoffSetup, /confirmation: confirmation\.trim\(\)/);
  assert.match(leaguePlayoffSetup, /Type the exact tournament name/);
  assert.match(leaguePlayoffSetup, /does not generate or reset fixtures/);
});


test('official points table is primary, format appears only on tournament overview', () => {
  const standingsTable = page.indexOf('title="Overall Standings"');
  const personalStatistics = page.indexOf('aria-label="Optional personal player statistics"');
  assert.ok(standingsTable !== -1 && personalStatistics > standingsTable);
  assert.doesNotMatch(page, /<TournamentFormatGuide/);
  assert.doesNotMatch(fixturePage, /<TournamentFormatGuide/);
  assert.match(tournamentOverview, /<TournamentFormatOverview/);
  assert.match(page, /aria-label={\`\$\{row\.points\} points\`\}/);
  assert.match(page, /bg-sky-400\/\[0\.08\].*tabular-nums/);
});

test('Awards feature only verified honours and keep live races above the catalogue', () => {
  assert.doesNotMatch(awards, /Explore verified assist leaders/);
  assert.match(awards, /Live award races are provisional/);
  assert.ok(awards.indexOf('Live Award Races') < awards.indexOf('Award Categories'));
  assert.match(awards, /Create Open Ballon Season/);
  assert.match(awards, /SOLO: 0/);
  assert.match(awards, /DUO: 0/);
  assert.match(awards, /TEAM: 0/);
});
