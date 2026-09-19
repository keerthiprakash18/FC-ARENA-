-- AlterTable
ALTER TABLE "tournament_registrations" ADD COLUMN     "entryLogoUrl" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
