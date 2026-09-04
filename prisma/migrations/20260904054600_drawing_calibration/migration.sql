-- Per-sheet calibration for geometry-derived linear and area takeoff.
CREATE TABLE IF NOT EXISTS "DrawingCalibration" (
  "id" TEXT PRIMARY KEY,
  "drawingRevisionId" TEXT NOT NULL UNIQUE,
  "accountId" TEXT NOT NULL,
  "x1" DOUBLE PRECISION NOT NULL,
  "y1" DOUBLE PRECISION NOT NULL,
  "x2" DOUBLE PRECISION NOT NULL,
  "y2" DOUBLE PRECISION NOT NULL,
  "realDistance" DOUBLE PRECISION NOT NULL,
  "realUnit" TEXT NOT NULL DEFAULT 'FT',
  "scaleFactor" DOUBLE PRECISION NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrawingCalibration_revision_fkey" FOREIGN KEY ("drawingRevisionId") REFERENCES "DrawingRevision"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DrawingCalibration_account_idx" ON "DrawingCalibration"("accountId");
