import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shell = fs.readFileSync(path.join(root, 'ops/verify-isolated-db-restore.sh'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/readiness-steps-11-15.yml'), 'utf8');

test('restore rehearsal is restricted to disposable localhost GitHub Actions database', () => {
  assert.match(shell, /FC_ARENA_ISOLATED_RESTORE:-/);
  assert.match(shell, /CI:-/);
  assert.match(shell, /PGHOST:-.*127\.0\.0\.1/);
  assert.match(shell, /PGDATABASE:-.*fcarena_test/);
  assert.match(shell, /PGUSER:-.*postgres/);
  assert.match(shell, /source_db="fcarena_test"/);
  assert.match(shell, /restore_db="fcarena_restore_rehearsal"/);
  assert.match(shell, /already exists\. Never overwrite it/);
  assert.match(shell, /ISOLATED_RESTORE_REHEARSAL=PASS/);
});
test('rehearsal proves data and migrations actually restore, never runs against production', () => {
  assert.match(shell, /pg_dump --no-password --format=custom/);
  assert.match(shell, /pg_restore --list/);
  assert.match(shell, /pg_restore --no-password --no-owner --no-privileges --exit-on-error/);
  assert.match(shell, /fc-arena-isolated-backup-sentinel/);
  assert.match(shell, /restored_marker/);
  assert.match(shell, /source_migrations/);
  assert.doesNotMatch(shell, /\bDROP\s+DATABASE\b/i);
  assert.doesNotMatch(shell, /\bgit\s+(reset|clean|pull)\b/i);
});
test('API staging workflow executes the isolated restore with explicit opt-in', () => {
  assert.match(workflow, /Disposable PostgreSQL backup and isolated restore rehearsal/);
  assert.match(workflow, /FC_ARENA_ISOLATED_RESTORE: "1"/);
  assert.match(workflow, /bash ops\/verify-isolated-db-restore\.sh/);
});
