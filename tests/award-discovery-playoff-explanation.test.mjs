import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { describeSavedPlayoffs } from '../apps/web/src/lib/saved-playoff-explainer.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('explains saved Top 8 one-table league and identifies knockout winner as champion', () => {
  const guide = describeSavedPlayoffs({
    competitionFormat: 'GROUP_STAGE_KNOCKOUT',
    playoffSource: 'OVERALL_STANDINGS',
    playoffQualifiersTotal: 8,
    playoffSeedingBasis: 'OVERALL_PERFORMANCE',
    playoffFormat: 'GLOBAL_SEEDED',
    approvedEntries: 20,
  });
  assert.match(guide.qualifierRule, /top 8 entries in the final overall standings/);
  assert.deepEqual(guide.rounds, ['Quarter-finals (8 teams)', 'Semi-finals (4 teams)', 'Final (2 teams)', 'Champion']);
  assert.match(guide.winnerRule, /NOT automatically champion/);
  assert.match(guide.openingExample, /#1 vs #8/);
  assert.equal(guide.knockoutFixtureCount, 7);
  assert.match(guide.selection, /provisional/);
  assert.match(guide.reminder, /not a live fixture draw/);
});

test('does not claim protected-seed one-table format separates group winners', () => {
  const guide = describeSavedPlayoffs({
    competitionFormat: 'GROUP_STAGE_KNOCKOUT',
    playoffSource: 'OVERALL_STANDINGS',
    playoffQualifiersTotal: 4,
    playoffFormat: 'PROTECTED_SEED',
  });
  assert.match(guide.mechanism, /same standard seeded knockout as Global Seeded/);
  assert.match(guide.mechanism, /only when multiple groups exist/);
  assert.deepEqual(guide.rounds, ['Semi-finals (4 teams)', 'Final (2 teams)', 'Champion']);
});

test('shows Double-Chance as partial rescue for elite seeds, not full double elimination', () => {
  const guide = describeSavedPlayoffs({
    competitionFormat: 'GROUP_STAGE_KNOCKOUT',
    playoffSource: 'OVERALL_STANDINGS',
    playoffQualifiersTotal: 8,
    playoffFormat: 'DOUBLE_CHANCE',
  });
  assert.match(guide.mechanism, /partial second-chance format, not full double elimination/);
  assert.match(guide.mechanism, /top 4/);
  assert.ok(guide.rounds.some(r => /Second Chance/.test(r)));
  assert.ok(guide.rounds.some(r => /Semi-finals/.test(r)));
});

test('awards are discoverable from both global and tournament pages', () => {
  const global = content('apps/web/src/app/awards/page.tsx');
  const more = content('apps/web/src/app/more/page.tsx');
  const tournament = content('apps/web/src/app/tournaments/[tournamentId]/page.tsx');
  const awards = content('apps/web/src/app/tournaments/[tournamentId]/achievements/page.tsx');
  const summary = content('apps/web/src/app/tournaments/[tournamentId]/summary/page.tsx');
  assert.match(more, /href:\s*"\/awards",\s*icon:\s*"🏆",\s*title:\s*"Awards & DUO\/TEAM Honours"/);
  assert.match(more, /group\.items\.map\(item => <FcMenuRow key=\{item\.href\} \{\.\.\.item\} \/>\)/);
  assert.match(global, /Where are my awards/);
  assert.match(global, /Choose Tournament/);
  assert.match(global, /Team Trophy Archive/);
  assert.match(tournament, /DUO Player \+ Team Awards/);
  assert.match(tournament, /View Tournament Awards/);
  assert.match(tournament, /summary#team-honours/);
  assert.match(summary, /id="team-honours"/);
  assert.match(awards, /DUO: Individual \+ Team Honours/);
  assert.match(awards, /LIVE RACES · NOT FINAL/);
  assert.match(awards, /OFFICIAL WINNERS PUBLISHED/);
  assert.match(awards, /Team Defensive Record/);
});

test('saved playoff explanation is immediately visible on the Playoff Center', () => {
  const playoff = content('apps/web/src/app/tournaments/[tournamentId]/playoffs/page.tsx');
  const overview = content('apps/web/src/components/tournaments/tournament-format-overview.tsx');
  const configuration = content('apps/web/src/components/tournaments/league-playoff-setup.tsx');
  const explainer = content('apps/web/src/components/tournaments/saved-playoff-explanation.tsx');
  assert.match(playoff, /<SavedPlayoffExplanation/);
  assert.ok(playoff.indexOf('<SavedPlayoffExplanation') < playoff.indexOf('Saved Playoff Setup'));
  assert.match(explainer, /League progress:/);
  assert.match(explainer, /Bracket creation unlocks/);
  assert.match(overview, /See How This Playoff Works/);
  assert.match(configuration, /Your selected playoff format preview/);
});
