-- Unified spatial context foundation for Matterport/reality capture and annotations.

CREATE TABLE IF NOT EXISTS "RealityCaptureSpace" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'MATTERPORT',
  "name" TEXT NOT NULL,
  "modelId" TEXT,
  "externalUrl" TEXT NOT NULL,
  "embedUrl" TEXT,
  "capturedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "description" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RealityCaptureSpace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RealityCaptureSpace_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RealityCaptureSpace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RealityCaptureSpace_project_idx" ON "RealityCaptureSpace"("projectId","accountId");
CREATE INDEX IF NOT EXISTS "RealityCaptureSpace_provider_idx" ON "RealityCaptureSpace"("accountId","provider");

CREATE TABLE IF NOT EXISTS "SpatialAnnotation" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "contextType" TEXT NOT NULL,
  "drawingRevisionId" TEXT,
  "realityCaptureSpaceId" TEXT,
  "spatialObjectId" TEXT,
  "annotationType" TEXT NOT NULL DEFAULT 'NOTE',
  "title" TEXT NOT NULL,
  "body" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "geometryJson" JSONB,
  "matterportPoseJson" JSONB,
  "assignedToId" TEXT,
  "linkedEntityType" TEXT,
  "linkedEntityId" TEXT,
  "createdById" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpatialAnnotation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotation_drawingRevisionId_fkey" FOREIGN KEY ("drawingRevisionId") REFERENCES "DrawingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotation_realityCaptureSpaceId_fkey" FOREIGN KEY ("realityCaptureSpaceId") REFERENCES "RealityCaptureSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotation_spatialObjectId_fkey" FOREIGN KEY ("spatialObjectId") REFERENCES "SpatialTakeoffObject"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotation_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotation_context_check" CHECK (
    ("contextType"='DRAWING' AND "drawingRevisionId" IS NOT NULL)
    OR ("contextType"='MATTERPORT' AND "realityCaptureSpaceId" IS NOT NULL)
    OR ("contextType"='PROJECT')
  )
);
CREATE INDEX IF NOT EXISTS "SpatialAnnotation_project_status_idx" ON "SpatialAnnotation"("projectId","accountId","status");
CREATE INDEX IF NOT EXISTS "SpatialAnnotation_drawing_idx" ON "SpatialAnnotation"("drawingRevisionId") WHERE "drawingRevisionId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "SpatialAnnotation_reality_idx" ON "SpatialAnnotation"("realityCaptureSpaceId") WHERE "realityCaptureSpaceId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "SpatialAnnotation_linked_entity_idx" ON "SpatialAnnotation"("accountId","linkedEntityType","linkedEntityId");

CREATE TABLE IF NOT EXISTS "SpatialAnnotationRevision" (
  "id" TEXT PRIMARY KEY,
  "annotationId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "status" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "geometryJson" JSONB,
  "matterportPoseJson" JSONB,
  "reason" TEXT,
  "editedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpatialAnnotationRevision_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "SpatialAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotationRevision_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpatialAnnotationRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SpatialAnnotationRevision_annotation_created_idx" ON "SpatialAnnotationRevision"("annotationId","createdAt" DESC);
