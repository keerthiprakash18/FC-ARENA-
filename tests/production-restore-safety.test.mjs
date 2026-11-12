import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shell = fs.readFileSync(path.join(root,'ops/verify-production-dump-offline.sh'),'utf8');
const main = fs.readFileSync(path.join(root,'ops/build-staging-source-manifest.py'),'utf8');
const compare = fs.readFileSync(path.join(root,'ops/compare-vps-source-inventory.py'),'utf8');

test('offline actual backup restore refuses accidental remote or production DB contact', () => {
  assert.match(shell,/FC_ARENA_OFFLINE_RESTORE:-/);
  assert.match(shell,/I_UNDERSTAND/);
  assert.match(shell,/fcarena-prod/);
  assert.match(shell,/\/opt\/fcarena\/backups\/postgres/);
  assert.match(shell,/--network none/);
  assert.match(shell,/--read-only/);
  assert.match(shell,/--security-opt no-new-privileges/);
  assert.match(shell,/sha256sum --check --status/);
  assert.match(shell,/pg_restore --list/);
  assert.match(shell,/pg_restore[\s\S]*--exit-on-error/);
  assert.match(shell,/fcarena_restore_rehearsal/);
  assert.match(shell,/docker rm -f/);
  assert.doesNotMatch(shell,/^\s*(?:dropdb|pg_dump|DROP DATABASE|ALTER SYSTEM)\b/im);
});

test('actual backup evidence is private and cannot contain credentials or player rows', () => {
  assert.match(shell,/\/root\/fcarena-safety/);
  assert.match(shell,/0o600/);
  assert.match(shell,/No production PostgreSQL server contacted/);
  assert.match(shell,/offline-network-disconnected-disposable-docker/);
  assert.doesNotMatch(shell, /\b(?:curl|wget|scp|rsync|http:\/\/|https:\/\/)\b/);
});

test('candidate source manifest is immutable and guards tracked secrets', () => {
  assert.match(main,/git\("rev-parse", "HEAD"\)/);
  assert.match(main,/git\("ls-files", "-z"\)/);
  assert.match(main,/sourceOnly/);
  assert.match(main,/sha256/);
  assert.match(main,/Tracked sensitive source path/);
  assert.match(compare,/NO_SOURCE_CONFLICTS_FOUND/);
  assert.match(compare,/BLOCKED_SOURCE_DRIFT/);
  assert.match(compare,/Even NO_SOURCE_CONFLICTS_FOUND does not authorize production deployment/);
});
