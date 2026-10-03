# Step 11 — Database Query Optimization

Status: implementation ready; accepted when the Steps 11–15 CI migration/index verification and API suite are green.

## Changes

Nine additive PostgreSQL indexes were added for observed production read patterns:

- active/recent Tournaments by League
- a user's Tournament registration membership lookup
- Fixture status/schedule scans
- Match status/update scans
- Result submission history per Match
- unread/recent Notifications
- Push device scheduling
- Safety report rate/count lookups
- Safety report resolution history

The migration is additive only and does not delete or rewrite production rows. `scripts/verify-step11-indexes.mjs` verifies the exact indexes after `prisma migrate deploy` on an isolated database.

## Safety

- No production DB reset.
- No destructive migration.
- Existing uniqueness/foreign-key constraints are unchanged.
- Query correctness remains covered by the API unit/E2E suite.
- Production-like EXPLAIN analysis can be repeated later with production-sized anonymized staging data, but is not required to deploy these additive indexes.
