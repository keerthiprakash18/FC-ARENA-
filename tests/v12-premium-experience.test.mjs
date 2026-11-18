import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describePlayoffVisualRules } from '../apps/web/src/lib/playoff-visual-rules.ts';
import { sampleSeededKnockoutRounds } from '../apps/web/src/lib/playoff-flow-data.ts';
import { getMatchdayGuidance } from '../apps/web/src/lib/matchday-guidance.ts';
import { describeSavedPlayoffs } from '../apps/web/src/lib/saved-playoff-explainer.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('all qualification sources use saved rules, not a fabricated single-table Top N', () => {
  const group = describePlayoffVisualRules({
    competitionFormat: 'GROUP_STAGE_KNOCKOUT', playoffSource: 'GROUP_QUALIFIERS',
    groupCount: 4, qualifiersPerGroup: 2, playoffQualifiersTotal: 8,
    playoffSeedingBasis: 'GROUP_POSITION',
  });
  assert.equal(group.stageTitle, '4 group tables');
  assert.equal(group.qualificationTitle, 'Top 2 per group');
  assert.match(group.qualificationDetail, /8 total/);
  assert.equal(group.seededExamplesAllowed, false);
  assert.doesNotMatch(group.qualificationTitle, /Top 8 overall/);

  const bestThird = describePlayoffVisualRules({
    competitionFormat: 'GROUP_STAGE_KNOCKOUT', playoffSource: 'GROUP_QUALIFIERS',
    groupCount: 7, qualifiersPerGroup: 2, playoffQualifiersTotal: 16,
    playoffSeedingBasis: 'RANDOM',
  });
  assert.equal(bestThird.qualificationTitle, '14 + 2 = 16 teams');
  assert.match(bestThird.qualificationDetail, /best 2 third-place/);
  assert.equal(bestThird.seededExamplesAllowed, false);
  assert.match(describeSavedPlayoffs({
    competitionFormat: 'GROUP_STAGE_KNOCKOUT', playoffSource: 'GROUP_QUALIFIERS',
    groupCount: 7, qualifiersPerGroup: 2, playoffQualifiersTotal: 16,
    playoffSeedingBasis: 'RANDOM',
  }).qualifierRule, /best 2 third-place teams/);

  const overall = describePlayoffVisualRules({
    competitionFormat: 'GROUP_STAGE_KNOCKOUT', playoffSource: 'OVERALL_STANDINGS',
    playoffQualifiersTotal: 8, playoffSeedingBasis: 'OVERALL_PERFORMANCE',
  });
  assert.equal(overall.qualificationTitle, 'Top 8 overall');
  assert.equal(overall.seededExamplesAllowed, true);

  const ucl = describePlayoffVisualRules({
    competitionFormat: 'UCL_CUP', playoffSource: 'OVERALL_STANDINGS',
    playoffQualifiersTotal: 16,
  });
  assert.equal(ucl.qualificationTitle, 'UCL knockout qualification');
  assert.equal(ucl.seededExamplesAllowed, false);
  assert.match(describeSavedPlayoffs({ competitionFormat: 'UCL_CUP', playoffQualifiersTotal: 16 }).qualifierRule, /UCL league-phase/);

  const direct = describePlayoffVisualRules({
    competitionFormat: 'SINGLE_ELIMINATION', playoffQualifiersTotal: 8,
  });
  assert.equal(direct.qualificationTitle, 'Direct knockout draw');
  assert.equal(direct.seededExamplesAllowed, false);
});

test('seed example bracket traces each winner through the real 4/8/16 round sizes', () => {
  for (const count of [4, 8, 16]) {
    const rounds = sampleSeededKnockoutRounds(count);
    assert.equal(rounds.length, Math.log2(count));
    assert.equal(rounds[0].matches.length, count / 2);
    assert.equal(rounds.at(-1).matches.length, 1);
    assert.match(rounds[0].matches[0], new RegExp(`#1 vs #${count}`));
    assert.ok(rounds.every((round, i) => round.matches.length === count / (2 ** (i + 1))));
  }
  assert.deepEqual(sampleSeededKnockoutRounds(6), []);
  assert.match(sampleSeededKnockoutRounds(8)[1].matches[0], /winner QF1 vs winner QF2/);
  assert.match(sampleSeededKnockoutRounds(16)[1].matches[0], /winner R16-1 vs winner R16-2/);
});

test('matchday guidance is state-specific and never asserts unverified results', () => {
  const states = ['LIVE', 'TODAY', 'UPCOMING', 'POSTPONED', 'UNSCHEDULED', 'PENDING'];
  const headlines = new Set();
  for (const state of states) {
    const value = getMatchdayGuidance(state);
    assert.ok(value.heading && value.description && value.actionLabel);
    assert.doesNotMatch(value.description, /you won|you lost|verified victory/i);
    headlines.add(value.heading);
  }
  assert.equal(headlines.size, states.length);
});

test('premium enhancements preserve safety and use existing trusted data', () => {
  const page = read('apps/web/src/app/tournaments/[tournamentId]/playoffs/page.tsx');
  const saved = read('apps/web/src/components/tournaments/saved-playoff-explanation.tsx');
  const diagram = read('apps/web/src/components/tournaments/playoff-flow-diagram.tsx');
  const settings = read('apps/web/src/app/tournaments/[tournamentId]/settings/page.tsx');
  const dashboard = read('apps/web/src/app/dashboard/page.tsx');
  const career = read('apps/web/src/app/career/page.tsx');
  assert.match(page, /groupCount=\{groupCount\}/);
  assert.match(saved, /<PlayoffFlowDiagram guide=\{guide\} tournament=\{settings\}/);
  assert.match(diagram, /sampleSeededKnockoutRounds/);
  assert.match(diagram, /not live fixtures/);
  assert.match(diagram, /scroll sideways|Scroll sideways/i);
  assert.match(settings, /<details id="advanced-safety"/);
  assert.ok(settings.indexOf('<details id="advanced-safety"') < settings.indexOf('Reset All Groups & Fixtures'));
  assert.match(settings, /confirmTournamentName/);
  assert.match(settings, /full-reset-preview/);
  assert.match(dashboard, /getMatchdayGuidance/);
  assert.match(dashboard, /aria-label="Your matchday next action"/);
  assert.match(career, /ShareCard/);
  assert.match(career, /career snapshot, not a dated season recap/i);
});
