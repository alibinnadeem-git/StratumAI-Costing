-- Drawing takeoff -> reusable assembly -> estimate lineage.
CREATE TABLE IF NOT EXISTS "SpatialAssemblyLink" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "spatialObjectId" TEXT NOT NULL,
  "assemblyId" TEXT NOT NULL,
  "estimateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpatialAssemblyLink_object_fkey" FOREIGN KEY ("spatialObjectId") REFERENCES "SpatialTakeoffObject"("id") ON DELETE CASCADE,
  CONSTRAINT "SpatialAssemblyLink_assembly_fkey" FOREIGN KEY ("assemblyId") REFERENCES "AssemblyDefinition"("id") ON DELETE CASCADE,
  CONSTRAINT "SpatialAssemblyLink_estimate_fkey" FOREIGN KEY ("estimateId") REFERENCES "CostEstimate"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "SpatialAssemblyLink_object_assembly_estimate_key" ON "SpatialAssemblyLink"("spatialObjectId","assemblyId",COALESCE("estimateId",''));
CREATE INDEX IF NOT EXISTS "SpatialAssemblyLink_account_idx" ON "SpatialAssemblyLink"("accountId");
