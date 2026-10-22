-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('PUBLISHED');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "assignedToUserId" UUID,
    "subject" VARCHAR(180) NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_ticket_messages" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_status_publishedAt_idx" ON "announcements"("status", "publishedAt");
CREATE INDEX "announcements_createdByUserId_createdAt_idx" ON "announcements"("createdByUserId", "createdAt");
CREATE INDEX "support_tickets_createdByUserId_updatedAt_idx" ON "support_tickets"("createdByUserId", "updatedAt");
CREATE INDEX "support_tickets_status_updatedAt_idx" ON "support_tickets"("status", "updatedAt");
CREATE INDEX "support_tickets_assignedToUserId_status_idx" ON "support_tickets"("assignedToUserId", "status");
CREATE INDEX "support_ticket_messages_ticketId_createdAt_idx" ON "support_ticket_messages"("ticketId", "createdAt");
CREATE INDEX "support_ticket_messages_authorUserId_createdAt_idx" ON "support_ticket_messages"("authorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
