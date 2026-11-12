import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('wizard lets admins explicitly set at most one extra next-place qualifier per group', () => {
  const page = read('apps/web/src/app/tournaments/[tournamentId]/wizard/qualification/page.tsx');
  assert.match(page, /Extra best next-place qualifiers/);
  assert.match(page, /min="0"/);
  assert.match(page, /max=\{Math\.max\(0, groupCount\)\}/);
  assert.match(page, /groupCount \* qualifiersPerGroup \+ extraNextPlaces/);
  assert.match(page, /setExtraNextPlaces/);
  assert.match(page, /equal.*group/i);
});

test('review spells out direct field plus confirmed cross-group next places', () => {
  const page = read('apps/web/src/app/tournaments/[tournamentId]/wizard/review/page.tsx');
  assert.match(page, /tournament\.playoffQualifiersTotal/);
  assert.match(page, /next-place finishers across balanced groups/);
  assert.match(page, /Only the direct group positions are guaranteed/);
});

test('backend keeps extra qualifiers opt-in and never changes current UCL saved-source policy', () => {
  const service = read('apps/api/src/tournaments/tournament-wizard-finalize.service.ts');
  assert.match(service, /GROUP_QUALIFICATION_TOTAL_MISMATCH/);
  assert.match(service, /GROUPS_MUST_BE_BALANCED_FOR_EXTRA_QUALIFIERS/);
  assert.match(service, /playoffQualifiersTotal = requestedTotal/);
  assert.match(service, /tournament\.competitionFormat === 'UCL_CUP'/);
});
