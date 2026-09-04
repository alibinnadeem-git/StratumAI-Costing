CREATE TABLE IF NOT EXISTS "SpatialTakeoffRevision" (
  "id" text PRIMARY KEY,
  "spatialObjectId" text NOT NULL,
  "accountId" text NOT NULL,
  "geometryJson" jsonb,
  "quantity" double precision NOT NULL,
  "measurement" double precision,
  "rawMeasurement" double precision,
  "calibrationId" text,
  "calibrationScaleFactor" double precision,
  "calibrationUnit" text,
  "confidence" double precision,
  "reason" text,
  "editedById" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpatialTakeoffRevision_spatialObjectId_fkey" FOREIGN KEY ("spatialObjectId") REFERENCES "SpatialTakeoffObject"("id") ON DELETE CASCADE,
  CONSTRAINT "SpatialTakeoffRevision_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE,
  CONSTRAINT "SpatialTakeoffRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "SpatialTakeoffRevision_object_created_idx"
  ON "SpatialTakeoffRevision" ("spatialObjectId", "createdAt" DESC);
