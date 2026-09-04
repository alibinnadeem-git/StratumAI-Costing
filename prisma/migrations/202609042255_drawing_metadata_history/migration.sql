CREATE TABLE IF NOT EXISTS "DrawingMetadataRevision" (
  "id" TEXT PRIMARY KEY,
  "drawingRevisionId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "previousSheetNumber" TEXT NOT NULL,
  "previousSheetTitle" TEXT,
  "previousRevision" TEXT NOT NULL,
  "newSheetNumber" TEXT NOT NULL,
  "newSheetTitle" TEXT,
  "newRevision" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'PDF_TEXT_REVIEW',
  "extractedJson" JSONB,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrawingMetadataRevision_drawingRevisionId_fkey" FOREIGN KEY ("drawingRevisionId") REFERENCES "DrawingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DrawingMetadataRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DrawingMetadataRevision_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DrawingMetadataRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DrawingMetadataRevision_revision_created_idx" ON "DrawingMetadataRevision"("drawingRevisionId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DrawingMetadataRevision_project_created_idx" ON "DrawingMetadataRevision"("projectId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DrawingMetadataRevision_account_created_idx" ON "DrawingMetadataRevision"("accountId","createdAt" DESC);
