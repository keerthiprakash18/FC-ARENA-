import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('safe scheduling is invisible unless enabled and never updates fixture or result', () => {
  const component = read('apps/web/src/components/matches/match-time-coordination.tsx');
  const service = read('apps/api/src/matches/matches.service.ts');
  assert.match(component, /if \(!data\?\.enabled\) return null/);
  assert.match(component, /Only an authorized admin can reschedule the fixture/);
  assert.match(component, /datetime-local/);
  assert.match(component, /timeZone: 'Asia\/Kolkata'/);
  assert.match(service, /MATCH_TIME_PROPOSALS_ENABLED !== 'true'/);
  assert.match(service, /officialScheduleUnchanged: true/);
  assert.match(service, /'MATCH_TIME_ACCEPTED'/);
});
test('new proposals are an additive indexed relation with audit and migration', () => {
  const prisma = read('apps/api/prisma/schema.prisma');
  const migration = read('apps/api/prisma/migrations/20261112100000_match_time_proposals/migration.sql');
  assert.match(prisma, /model MatchTimeProposal \{/);
  assert.match(prisma, /@@index\(\[matchId, status, createdAt\]\)/);
  assert.match(migration, /CREATE TABLE "match_time_proposals"/);
  assert.doesNotMatch(migration, /\b(?:DROP TABLE|DELETE FROM|TRUNCATE)\b/);
});
