ALTER TABLE "result_submissions"
  ADD COLUMN "homePenaltyScore" INTEGER,
  ADD COLUMN "awayPenaltyScore" INTEGER;

ALTER TABLE "result_submissions" ADD CONSTRAINT "result_submissions_penalty_scores_valid"
  CHECK (
    ("homePenaltyScore" IS NULL AND "awayPenaltyScore" IS NULL)
    OR ("homePenaltyScore" IS NOT NULL AND "awayPenaltyScore" IS NOT NULL
      AND "homePenaltyScore" BETWEEN 0 AND 99 AND "awayPenaltyScore" BETWEEN 0 AND 99
      AND "homePenaltyScore" <> "awayPenaltyScore")
  );
