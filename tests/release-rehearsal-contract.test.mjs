import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('final CI gate requires a distinct disposable source rollback', () => {
  const workflow=read('.github/workflows/readiness-steps-16-20.yml');
  const shell=read('ops/rehearse-source-rollback-ci.sh');
  assert.match(workflow,/Rehearse release source rollback in disposable CI tree/);
  assert.match(workflow,/FC_ARENA_ROLLBACK_REHEARSAL: "1"/);
  assert.match(workflow,/bash ops\/rehearse-source-rollback-ci\.sh/);
  assert.match(shell,/FC_ARENA_ROLLBACK_REHEARSAL:-/);
  assert.match(shell,/git archive --format=tar HEAD\^/);
  assert.match(shell,/sha256sum -c/);
  assert.match(shell,/ISOLATED_SOURCE_ROLLBACK_REHEARSAL=PASS/);
  assert.match(shell,/No VPS services, migrations, live data/);
  assert.doesNotMatch(shell,/\b(?:systemctl|pm2|rsync|ssh|scp|pg_restore|pg_dump)\b/);
});

test('tested candidate includes hashes for safely classifying each reported source change', () => {
  const workflow=read('.github/workflows/readiness-steps-11-15.yml');
  const source=read('ops/build-staging-source-manifest.py');
  assert.match(workflow,/SOURCE_MANIFEST\.json/);
  assert.match(workflow,/Retain tested staging source for review only/);
  assert.match(source,/sha256/);
  assert.match(source,/commitSha/);
  assert.match(workflow,/--source-archive \/tmp\/fcarena-staging-candidate\/source\.tar\.gz/);
  assert.match(source,/tarfile\.open\(archive_path, "r:gz"\)/);
  assert.match(source,/archive\.extractfile\(item\)/);
  assert.match(source,/set\(files\) != tracked/);

  assert.match(source,/fileCount/);
});

test('real production inspection remains an explicit operator-only task', () => {
  const comparator=read('ops/compare-vps-source-inventory.py');
  assert.match(comparator,/fcarena-prod/);
  assert.match(comparator,/BLOCKED_SOURCE_DRIFT/);
  assert.match(comparator,/Private report stored under \/root\/fcarena-safety/);
  assert.doesNotMatch(comparator,/\b(?:subprocess|systemctl|git reset|git clean|pg_restore)\b/);
});
