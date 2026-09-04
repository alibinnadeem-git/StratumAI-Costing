ALTER TABLE "DrawingRevision"
  ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;

DO $$ BEGIN
  ALTER TABLE "DrawingRevision"
    ADD CONSTRAINT "DrawingRevision_reviewStatus_check"
    CHECK ("reviewStatus" IN ('PENDING','ACCEPTED','REJECTED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "DrawingRevision_reviewStatus_idx"
  ON "DrawingRevision"("accountId", "reviewStatus");
