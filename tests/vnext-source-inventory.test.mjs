import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = fs.readFileSync(path.join(root, 'ops/vnext-production-source-inventory.py'), 'utf8');

test('inventory remains private on the current FC ARENA VPS and never syncs files', () => {
  assert.match(script, /ROOT = Path\("\/opt\/fcarena"\)/);
  assert.match(script, /REPORT_DIR = Path\("\/root\/fcarena-safety"\)/);
  assert.match(script, /fcarena-prod/);
  assert.match(script, /os\.umask\(0o077\)/);
  assert.match(script, /os\.O_EXCL, 0o600/);
  assert.match(script, /Sensitive and generated\/user-data filenames\/content excluded/);
  assert.doesNotMatch(script, /\bgit\s+(?:pull|reset|clean|merge)\b/);
});
test('inventory hashes bounded regular source candidates but not credential or generated files', () => {
  assert.match(script, /MAX_HASH_BYTES = 32 \* 1024 \* 1024/);
  assert.match(script, /stat\.S_ISREG/);
  assert.match(script, /\.is_relative_to\(ROOT\.resolve\(\)\)/);
  assert.match(script, /"secret", "credential", "password", "token"/);
  assert.match(script, /generated_or_user_data/);
  assert.match(script, /"candidateFiles": rows/);
});
