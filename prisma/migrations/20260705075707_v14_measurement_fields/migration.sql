-- AlterTable
ALTER TABLE "measurements" ADD COLUMN     "informedConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDisasterArea" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tinggiBadanOrtu" DOUBLE PRECISION;
