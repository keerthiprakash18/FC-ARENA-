CREATE TYPE "MobileReleaseChannel" AS ENUM ('INTERNAL', 'CLOSED', 'PRODUCTION');
CREATE TYPE "MobileReleaseStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'SUPERSEDED');
CREATE TYPE "BackupRunStatus" AS ENUM ('SUCCESS', 'FAILED');

CREATE TABLE "android_releases" (
  "id" UUID NOT NULL,
  "versionCode" INTEGER NOT NULL,
  "versionName" VARCHAR(40) NOT NULL,
  "channel" "MobileReleaseChannel" NOT NULL DEFAULT 'INTERNAL',
  "status" "MobileReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "minimumSupportedVersionCode" INTEGER,
  "forceUpdateBelowVersionCode" INTEGER,
  "releaseNotes" TEXT,
  "playStoreUrl" TEXT,
  "sourceCommit" VARCHAR(40),
  "artifactSha256" VARCHAR(64),
  "createdByUserId" UUID NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "android_releases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_backup_runs" (
  "id" UUID NOT NULL,
  "status" "BackupRunStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "sizeBytes" VARCHAR(32),
  "checksumSha256" VARCHAR(64),
  "storageKind" VARCHAR(40) NOT NULL DEFAULT 'LOCAL',
  "retentionDays" INTEGER NOT NULL DEFAULT 14,
  "sourceHost" VARCHAR(120),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_backup_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "android_releases_versionCode_key"
  ON "android_releases"("versionCode");

CREATE INDEX "android_releases_channel_status_versionCode_idx"
  ON "android_releases"("channel", "status", "versionCode");

CREATE INDEX "android_releases_createdAt_idx"
  ON "android_releases"("createdAt");

CREATE INDEX "system_backup_runs_status_completedAt_idx"
  ON "system_backup_runs"("status", "completedAt");

CREATE INDEX "system_backup_runs_completedAt_idx"
  ON "system_backup_runs"("completedAt");

ALTER TABLE "android_releases"
  ADD CONSTRAINT "android_releases_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
