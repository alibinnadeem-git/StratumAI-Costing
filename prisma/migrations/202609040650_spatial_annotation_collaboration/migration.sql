CREATE TABLE IF NOT EXISTS "SpatialAnnotationComment" (
  "id" TEXT PRIMARY KEY,
  "annotationId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpatialAnnotationComment_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "SpatialAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotationComment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotationComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SpatialAnnotationComment_annotation_created_idx" ON "SpatialAnnotationComment"("annotationId","createdAt");

CREATE TABLE IF NOT EXISTS "SpatialContextLink" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "drawingRevisionId" TEXT NOT NULL,
  "realityCaptureSpaceId" TEXT NOT NULL,
  "label" TEXT,
  "drawingGeometryJson" JSONB,
  "matterportPoseJson" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpatialContextLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialContextLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialContextLink_drawingRevisionId_fkey" FOREIGN KEY ("drawingRevisionId") REFERENCES "DrawingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialContextLink_realityCaptureSpaceId_fkey" FOREIGN KEY ("realityCaptureSpaceId") REFERENCES "RealityCaptureSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialContextLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SpatialContextLink_project_idx" ON "SpatialContextLink"("projectId","accountId");
CREATE INDEX IF NOT EXISTS "SpatialContextLink_drawing_idx" ON "SpatialContextLink"("drawingRevisionId");
CREATE INDEX IF NOT EXISTS "SpatialContextLink_capture_idx" ON "SpatialContextLink"("realityCaptureSpaceId");
