-- Additive only: historical Duo tournaments retain their existing scoring mode.
ALTER TABLE "tournaments"
  ADD COLUMN IF NOT EXISTS "duoAggregateEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "result_submissions"
  ADD COLUMN IF NOT EXISTS "duoGames" JSONB;
