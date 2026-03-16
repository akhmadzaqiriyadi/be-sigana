-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "phone" TEXT,
ADD COLUMN "nik" TEXT,
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "villageId" INTEGER,
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill status from existing verification state
UPDATE "users"
SET "status" = CASE WHEN "isVerified" = true THEN 'ACTIVE'::"UserStatus" ELSE 'PENDING'::"UserStatus" END;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "device" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_targetId_createdAt_idx" ON "audit_logs"("targetId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "villages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
