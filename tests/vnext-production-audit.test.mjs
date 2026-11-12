import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = fs.readFileSync(path.join(root, 'ops/vnext-readonly-production-audit.sh'), 'utf8');

test('VCCLHosting read-only preflight is hard-pinned to the current production host', () => {
  assert.match(script, /EXPECTED_HOST="fcarena-prod"/);
  assert.match(script, /EXPECTED_IP="45\.129\.87\.8"/);
  assert.match(script, /REPO="\/opt\/fcarena"/);
  assert.match(script, /sha256sum --status -c/);
  assert.match(script, /pg_restore --list/);
  assert.match(script, /PREFLIGHT_READ_ONLY_OK/);
});
test('preflight never mutates working trees, restarts services or leaks environment', () => {
  assert.doesNotMatch(script, /^\s*git\s+(pull|reset|clean|checkout|merge|fetch)\b/m);
  assert.doesNotMatch(script, /^\s*(?:sudo\s+)?systemctl\s+(restart|stop|start|enable)\b/m);
  assert.doesNotMatch(script, /^\s*(?:sudo\s+)?(psql|pg_restore)\s+.*(?:-d|--dbname|--clean)\b/m);
  assert.doesNotMatch(script, /^\s*(?:cat|sed|grep)\s+.*\.(?:env|pem|key)\b/m);
});
