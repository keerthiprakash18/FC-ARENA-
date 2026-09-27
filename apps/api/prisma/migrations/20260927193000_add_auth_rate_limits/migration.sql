CREATE TABLE "auth_rate_limits" (
  "action" VARCHAR(50) NOT NULL,
  "keyHash" VARCHAR(64) NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_rate_limits_pkey"
    PRIMARY KEY ("action", "keyHash")
);

CREATE INDEX "auth_rate_limits_updatedAt_idx"
  ON "auth_rate_limits" ("updatedAt");
