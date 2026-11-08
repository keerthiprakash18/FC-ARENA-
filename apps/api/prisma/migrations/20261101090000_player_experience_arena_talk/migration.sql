-- CreateEnum
CREATE TYPE "ArenaPostKind" AS ENUM ('DISCUSSION', 'QUESTION', 'NEWS', 'RUMOUR', 'RESULT');

-- CreateEnum
CREATE TYPE "ArenaReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "player_experience_preferences" (
    "userId" UUID NOT NULL,
    "frame" VARCHAR(20) NOT NULL DEFAULT 'CLASSIC',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_experience_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "arena_posts" (
    "id" UUID NOT NULL,
    "authorUserId" UUID,
    "leagueId" UUID,
    "sourceMatchId" UUID,
    "kind" "ArenaPostKind" NOT NULL DEFAULT 'DISCUSSION',
    "body" VARCHAR(2000) NOT NULL,
    "sourceUrl" VARCHAR(2048),
    "imageKey" VARCHAR(80),
    "clientRequestId" UUID,
    "requestHash" VARCHAR(64),
    "pollEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "arena_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_comments" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "clientRequestId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "arena_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_reactions" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_reactions_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "arena_poll_options" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "arena_poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_poll_votes" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_poll_votes_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "arena_reports" (
    "id" UUID NOT NULL,
    "reporterUserId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "commentId" UUID,
    "targetKey" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "details" VARCHAR(1000),
    "status" "ArenaReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedByUserId" UUID,
    "resolutionNote" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "arena_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arena_posts_sourceMatchId_key" ON "arena_posts"("sourceMatchId");

-- CreateIndex
CREATE INDEX "arena_posts_leagueId_hiddenAt_createdAt_id_idx" ON "arena_posts"("leagueId", "hiddenAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "arena_posts_authorUserId_createdAt_idx" ON "arena_posts"("authorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "arena_posts_authorUserId_clientRequestId_key" ON "arena_posts"("authorUserId", "clientRequestId");

-- CreateIndex
CREATE INDEX "arena_comments_postId_hiddenAt_createdAt_id_idx" ON "arena_comments"("postId", "hiddenAt", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "arena_comments_authorUserId_clientRequestId_key" ON "arena_comments"("authorUserId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "arena_poll_options_id_postId_key" ON "arena_poll_options"("id", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "arena_poll_options_postId_position_key" ON "arena_poll_options"("postId", "position");

-- CreateIndex
CREATE INDEX "arena_poll_votes_optionId_postId_idx" ON "arena_poll_votes"("optionId", "postId");

-- CreateIndex
CREATE INDEX "arena_reports_status_createdAt_idx" ON "arena_reports"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "arena_reports_reporterUserId_targetKey_key" ON "arena_reports"("reporterUserId", "targetKey");

-- AddForeignKey
ALTER TABLE "player_experience_preferences" ADD CONSTRAINT "player_experience_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_posts" ADD CONSTRAINT "arena_posts_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_posts" ADD CONSTRAINT "arena_posts_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_posts" ADD CONSTRAINT "arena_posts_sourceMatchId_fkey" FOREIGN KEY ("sourceMatchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_comments" ADD CONSTRAINT "arena_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "arena_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_comments" ADD CONSTRAINT "arena_comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_reactions" ADD CONSTRAINT "arena_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "arena_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_reactions" ADD CONSTRAINT "arena_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_poll_options" ADD CONSTRAINT "arena_poll_options_postId_fkey" FOREIGN KEY ("postId") REFERENCES "arena_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_poll_votes" ADD CONSTRAINT "arena_poll_votes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "arena_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_poll_votes" ADD CONSTRAINT "arena_poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_poll_votes" ADD CONSTRAINT "arena_poll_votes_optionId_postId_fkey" FOREIGN KEY ("optionId", "postId") REFERENCES "arena_poll_options"("id", "postId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_reports" ADD CONSTRAINT "arena_reports_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_reports" ADD CONSTRAINT "arena_reports_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_reports" ADD CONSTRAINT "arena_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "arena_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_reports" ADD CONSTRAINT "arena_reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "arena_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep official results distinct from member-authored posts.
ALTER TABLE arena_posts ADD CONSTRAINT arena_post_source_check CHECK (
 (kind = 'RESULT' AND "sourceMatchId" IS NOT NULL AND "leagueId" IS NOT NULL AND "authorUserId" IS NULL AND "clientRequestId" IS NULL)
 OR (kind <> 'RESULT' AND "sourceMatchId" IS NULL AND "authorUserId" IS NOT NULL AND "clientRequestId" IS NOT NULL AND length(btrim(body)) > 0)
);
ALTER TABLE player_experience_preferences ADD CONSTRAINT experience_frame_check CHECK (frame IN ('CLASSIC','SKY','GOLD','CHAMPION'));
ALTER TABLE arena_comments ADD CONSTRAINT arena_comment_body_check CHECK (length(btrim(body)) > 0);
ALTER TABLE arena_poll_options ADD CONSTRAINT arena_poll_option_check CHECK (position BETWEEN 0 AND 3 AND length(btrim(label)) > 0);
ALTER TABLE arena_posts ADD CONSTRAINT arena_poll_end_check CHECK ("pollEndsAt" IS NULL OR "pollEndsAt" > "createdAt");
CREATE INDEX IF NOT EXISTS experience_home_participants_idx ON match_result_stat_events USING GIN ((payload #> '{home,userIds}')) WHERE type = 'APPLY';
CREATE INDEX IF NOT EXISTS experience_away_participants_idx ON match_result_stat_events USING GIN ((payload #> '{away,userIds}')) WHERE type = 'APPLY';
