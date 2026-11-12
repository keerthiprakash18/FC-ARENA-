import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'apps/web/src/app/leaderboards/page.tsx'), 'utf8');

test('player ranking jump is keyboard accessible and honors reduced-motion preferences', () => {
  assert.match(source, /Find my rank/);
  assert.match(source, /focus-visible:outline-2/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /behavior: reduceMotion \? "auto" : "smooth"/);
});
