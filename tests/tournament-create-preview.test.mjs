import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(root, 'apps/web/src/app/leagues/[leagueId]/tournaments/page.tsx'), 'utf8');

test('draft creation format estimate is read-only and clearly labelled', () => {
  assert.match(code, /Quick format preview/);
  assert.match(code, /estimatedFixtureCount/);
  assert.match(code, /previewEntries \* \(previewEntries - 1\) \/ 2/);
  assert.match(code, /previewEntries \* \(previewEntries - 1\)/);
  assert.match(code, /previewEntries - 1/);
  assert.match(code, /estimate; the builder confirms final fixtures/);
  assert.match(code, /aria-pressed=\{competitionFormat === value\}/);
});

test('creation API still posts the selected actual tournament settings', () => {
  assert.match(code, /competitionFormat,\s*\n\s*groupMode:/);
  assert.match(code, /form\.get\(\s*'maxEntries'/);
  assert.match(code, /setEntryCount\(event\.target\.value\)/);
});
