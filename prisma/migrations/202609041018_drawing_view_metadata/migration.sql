ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "rotationDegrees" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "cropJson" JSONB;
ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "viewUpdatedAt" TIMESTAMP(3);
ALTER TABLE "DrawingRevision" ADD CONSTRAINT "DrawingRevision_rotation_check" CHECK ("rotationDegrees" IN (0,90,180,270));
CREATE INDEX IF NOT EXISTS "DrawingRevision_view_updated_idx" ON "DrawingRevision"("accountId","viewUpdatedAt");