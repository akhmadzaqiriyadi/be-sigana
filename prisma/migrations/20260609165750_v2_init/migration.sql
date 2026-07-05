-- AlterTable
ALTER TABLE "measurements" ADD COLUMN     "giziData" JSONB,
ADD COLUMN     "imunisasiData" JSONB,
ADD COLUMN     "klinikData" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pushSubscriptions" JSONB;

-- CreateIndex
CREATE INDEX "measurements_balitaId_idx" ON "measurements"("balitaId");

-- CreateIndex
CREATE INDEX "measurements_relawanId_idx" ON "measurements"("relawanId");

-- CreateIndex
CREATE INDEX "measurements_statusAkhir_idx" ON "measurements"("statusAkhir");

-- CreateIndex
CREATE INDEX "measurements_createdAt_idx" ON "measurements"("createdAt");

-- CreateIndex
CREATE INDEX "measurements_deletedAt_idx" ON "measurements"("deletedAt");
