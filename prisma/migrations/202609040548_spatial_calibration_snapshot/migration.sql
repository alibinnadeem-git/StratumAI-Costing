ALTER TABLE "SpatialTakeoffObject" ADD COLUMN IF NOT EXISTS "calibrationId" text;
ALTER TABLE "SpatialTakeoffObject" ADD COLUMN IF NOT EXISTS "rawMeasurement" double precision;
ALTER TABLE "SpatialTakeoffObject" ADD COLUMN IF NOT EXISTS "calibrationScaleFactor" double precision;
ALTER TABLE "SpatialTakeoffObject" ADD COLUMN IF NOT EXISTS "calibrationUnit" text;

CREATE INDEX IF NOT EXISTS "SpatialTakeoffObject_calibrationId_idx"
  ON "SpatialTakeoffObject" ("calibrationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SpatialTakeoffObject_calibrationId_fkey'
  ) THEN
    ALTER TABLE "SpatialTakeoffObject"
      ADD CONSTRAINT "SpatialTakeoffObject_calibrationId_fkey"
      FOREIGN KEY ("calibrationId") REFERENCES "DrawingCalibration"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
