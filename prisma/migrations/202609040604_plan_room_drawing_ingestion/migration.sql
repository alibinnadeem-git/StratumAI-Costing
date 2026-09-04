-- Plan Room -> drawing ingestion lineage.
-- Additive only: exact source revision/page provenance plus reviewable ingestion queue.

ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "sourceDocumentRevisionId" TEXT;
ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "sourcePageNumber" INTEGER;
CREATE INDEX IF NOT EXISTS "DrawingRevision_sourceDocumentRevisionId_idx" ON "DrawingRevision" ("sourceDocumentRevisionId");

CREATE TABLE IF NOT EXISTS "PlanRoomDrawingIngestion" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "documentRevisionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "discipline" TEXT NOT NULL DEFAULT 'ELECTRICAL',
  "detectedSheetNumber" TEXT,
  "detectedSheetTitle" TEXT,
  "detectedRevision" TEXT,
  "pageNumber" INTEGER,
  "drawingSetId" TEXT,
  "drawingRevisionId" TEXT,
  "confidence" DOUBLE PRECISION,
  "errorMessage" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanRoomDrawingIngestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE,
  CONSTRAINT "PlanRoomDrawingIngestion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE,
  CONSTRAINT "PlanRoomDrawingIngestion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProjectDocument"("id") ON DELETE CASCADE,
  CONSTRAINT "PlanRoomDrawingIngestion_documentRevisionId_fkey" FOREIGN KEY ("documentRevisionId") REFERENCES "ProjectDocumentRevision"("id") ON DELETE SET NULL,
  CONSTRAINT "PlanRoomDrawingIngestion_drawingSetId_fkey" FOREIGN KEY ("drawingSetId") REFERENCES "DrawingSet"("id") ON DELETE SET NULL,
  CONSTRAINT "PlanRoomDrawingIngestion_drawingRevisionId_fkey" FOREIGN KEY ("drawingRevisionId") REFERENCES "DrawingRevision"("id") ON DELETE SET NULL,
  CONSTRAINT "PlanRoomDrawingIngestion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "PlanRoomDrawingIngestion_project_status_idx" ON "PlanRoomDrawingIngestion" ("projectId","accountId","status");
CREATE UNIQUE INDEX IF NOT EXISTS "PlanRoomDrawingIngestion_source_page_key" ON "PlanRoomDrawingIngestion" ("documentRevisionId","pageNumber") WHERE "documentRevisionId" IS NOT NULL AND "pageNumber" IS NOT NULL;
