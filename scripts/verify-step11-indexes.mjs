import pg from 'pg';

const expected = [
  'tournaments_leagueId_status_createdAt_idx',
  'trm_user_tournament_registration_idx',
  'fixtures_tournamentId_status_scheduledAt_sequence_idx',
  'matches_tournamentId_status_updatedAt_idx',
  'result_submissions_matchId_status_createdAt_idx',
  'notifications_userId_readAt_eventAt_idx',
  'push_devices_userId_lastSyncedAt_idx',
  'audit_logs_actorUserId_action_createdAt_idx',
  'audit_logs_action_targetType_targetId_createdAt_idx',
];

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required.');

const parsed = new URL(url);
if (
  process.env.NODE_ENV === 'test' &&
  !['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname)
) {
  throw new Error('Step 11 index verification requires an isolated local test database.');
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const result = await client.query(
    `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = current_schema()
         AND indexname = ANY($1::text[])`,
    [expected],
  );

  const found = new Set(result.rows.map((row) => row.indexname));
  const missing = expected.filter((name) => !found.has(name));

  if (missing.length) {
    throw new Error(`Missing Step 11 indexes: ${missing.join(', ')}`);
  }

  console.log(`STEP11_INDEXES_OK count=${found.size}`);
} finally {
  await client.end();
}
