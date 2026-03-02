-- Migration: Remove Posko Entity
-- Generated: 2026-03-03
-- Step 1: Add latitude/longitude to villages (preserve posko geo-data)
ALTER TABLE "villages" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "villages" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- Step 2: Copy coordinates from first posko per village into the village row
UPDATE "villages" v
SET
  "latitude"  = p."latitude",
  "longitude" = p."longitude"
FROM (
  SELECT DISTINCT ON ("villageId") "villageId", "latitude", "longitude"
  FROM "poskos"
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
  ORDER BY "villageId", "id"
) p
WHERE p."villageId" = v."id";

-- Step 3: Drop FK constraint on balitas.poskoId
ALTER TABLE "balitas" DROP CONSTRAINT IF EXISTS "balitas_poskoId_fkey";

-- Step 4: Remove poskoId column from balitas
ALTER TABLE "balitas" DROP COLUMN IF EXISTS "poskoId";

-- Step 5: Drop the poskos table
DROP TABLE IF EXISTS "poskos";
