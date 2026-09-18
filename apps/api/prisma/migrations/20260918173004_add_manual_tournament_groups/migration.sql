-- AlterTable
ALTER TABLE "fixtures" ADD COLUMN     "groupId" UUID;

-- AlterTable
ALTER TABLE "tournament_registrations" ADD COLUMN     "groupId" UUID;

-- CreateTable
CREATE TABLE "tournament_groups" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_groups_tournamentId_idx" ON "tournament_groups"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_groups_tournamentId_name_key" ON "tournament_groups"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_groups_tournamentId_position_key" ON "tournament_groups"("tournamentId", "position");

-- CreateIndex
CREATE INDEX "fixtures_groupId_idx" ON "fixtures"("groupId");

-- CreateIndex
CREATE INDEX "tournament_registrations_groupId_idx" ON "tournament_registrations"("groupId");

-- AddForeignKey
ALTER TABLE "tournament_groups" ADD CONSTRAINT "tournament_groups_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "tournament_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "tournament_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
