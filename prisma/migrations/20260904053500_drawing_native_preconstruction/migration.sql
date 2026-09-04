CREATE TABLE IF NOT EXISTS "DrawingSet" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "discipline" TEXT NOT NULL DEFAULT 'ELECTRICAL',
  "description" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DrawingSet_project_account_idx" ON "DrawingSet"("projectId","accountId");

CREATE TABLE IF NOT EXISTS "DrawingRevision" (
  "id" TEXT PRIMARY KEY,
  "drawingSetId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sheetNumber" TEXT NOT NULL,
  "sheetTitle" TEXT,
  "revision" TEXT NOT NULL DEFAULT '0',
  "issuedAt" TIMESTAMP(3),
  "sourceDocumentId" TEXT,
  "externalUrl" TEXT,
  "width" DOUBLE PRECISION,
  "height" DOUBLE PRECISION,
  "scaleLabel" TEXT,
  "scaleNumerator" DOUBLE PRECISION,
  "scaleDenominator" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrawingRevision_drawingSetId_fkey" FOREIGN KEY ("drawingSetId") REFERENCES "DrawingSet"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DrawingRevision_set_sheet_rev_key" ON "DrawingRevision"("drawingSetId","sheetNumber","revision");
CREATE INDEX IF NOT EXISTS "DrawingRevision_account_idx" ON "DrawingRevision"("accountId");

CREATE TABLE IF NOT EXISTS "DrawingLayer" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'CONSTRUCTION',
  "systemCode" TEXT,
  "isVisibleDefault" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DrawingLayer_project_name_key" ON "DrawingLayer"("projectId","name");
CREATE INDEX IF NOT EXISTS "DrawingLayer_account_idx" ON "DrawingLayer"("accountId");

CREATE TABLE IF NOT EXISTS "SpatialTakeoffObject" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "drawingRevisionId" TEXT NOT NULL,
  "layerId" TEXT,
  "objectType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT 'EA',
  "geometryJson" JSONB,
  "measurement" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpatialTakeoffObject_revision_fkey" FOREIGN KEY ("drawingRevisionId") REFERENCES "DrawingRevision"("id") ON DELETE CASCADE,
  CONSTRAINT "SpatialTakeoffObject_layer_fkey" FOREIGN KEY ("layerId") REFERENCES "DrawingLayer"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "SpatialTakeoffObject_project_idx" ON "SpatialTakeoffObject"("projectId","accountId");
CREATE INDEX IF NOT EXISTS "SpatialTakeoffObject_revision_idx" ON "SpatialTakeoffObject"("drawingRevisionId");

CREATE TABLE IF NOT EXISTS "SpatialEstimateLink" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "spatialObjectId" TEXT NOT NULL,
  "estimateLineId" TEXT NOT NULL,
  "quantityBasis" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpatialEstimateLink_object_fkey" FOREIGN KEY ("spatialObjectId") REFERENCES "SpatialTakeoffObject"("id") ON DELETE CASCADE,
  CONSTRAINT "SpatialEstimateLink_estimateLine_fkey" FOREIGN KEY ("estimateLineId") REFERENCES "EstimateLineItem"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SpatialEstimateLink_object_line_key" ON "SpatialEstimateLink"("spatialObjectId","estimateLineId");
CREATE INDEX IF NOT EXISTS "SpatialEstimateLink_account_idx" ON "SpatialEstimateLink"("accountId");

CREATE TABLE IF NOT EXISTS "AssemblyDefinition" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "baseUnit" TEXT NOT NULL DEFAULT 'EA',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssemblyDefinition_account_name_key" ON "AssemblyDefinition"("accountId","name");

CREATE TABLE IF NOT EXISTS "AssemblyComponent" (
  "id" TEXT PRIMARY KEY,
  "assemblyId" TEXT NOT NULL,
  "costItemId" TEXT,
  "description" TEXT NOT NULL,
  "quantityFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT 'EA',
  "materialCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "laborHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssemblyComponent_assembly_fkey" FOREIGN KEY ("assemblyId") REFERENCES "AssemblyDefinition"("id") ON DELETE CASCADE,
  CONSTRAINT "AssemblyComponent_costItem_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "AssemblyComponent_assembly_idx" ON "AssemblyComponent"("assemblyId");