import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(project, 'apps/web/src/app/tournaments/[tournamentId]/wizard/review/page.tsx'), 'utf8');

test('tournament review uses theme-aware colors and readable summary', () => {
  assert.match(source, /var\(--theme-border\)/);
  assert.match(source, /var\(--theme-surface\)/);
  assert.match(source, /Before you publish/);
  assert.match(source, /aria-labelledby="publish-checklist-title"/);
  assert.doesNotMatch(source, /\bbg-black\/20\b|\btext-slate-600\b|\bborder-white\/10\b/);
});

test('tournament publication still requires explicit confirmation', () => {
  assert.match(source, /await confirmAction\(/);
  assert.match(source, /Publish tournament\?/);
  assert.match(source, /method:\s*'POST'/);
});
