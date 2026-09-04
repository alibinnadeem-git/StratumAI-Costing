ALTER TABLE "SpatialAnnotation" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "SpatialAnnotation_due_idx" ON "SpatialAnnotation"("accountId","projectId","dueAt") WHERE "dueAt" IS NOT NULL;
