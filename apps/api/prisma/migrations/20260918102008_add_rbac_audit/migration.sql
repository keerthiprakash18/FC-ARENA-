-- CreateEnum
CREATE TYPE "ScopedRole" AS ENUM ('TOURNAMENT_ADMIN', 'TEAM_MANAGER', 'CAPTAIN', 'PLAYER', 'MATCH_OFFICIAL', 'VIEWER');

-- CreateEnum
CREATE TYPE "RoleScopeType" AS ENUM ('GLOBAL', 'LEAGUE', 'TOURNAMENT');

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ScopedRole" NOT NULL,
    "scopeType" "RoleScopeType" NOT NULL,
    "scopeId" VARCHAR(120) NOT NULL,
    "assignedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(160) NOT NULL,
    "targetType" VARCHAR(100) NOT NULL,
    "targetId" VARCHAR(160) NOT NULL,
    "scopeType" VARCHAR(50),
    "scopeId" VARCHAR(160),
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_assignments_userId_scopeType_scopeId_idx" ON "role_assignments"("userId", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "role_assignments_scopeType_scopeId_idx" ON "role_assignments"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_userId_role_scopeType_scopeId_key" ON "role_assignments"("userId", "role", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_scopeType_scopeId_createdAt_idx" ON "audit_logs"("scopeType", "scopeId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
