-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RELAWAN', 'ADMIN', 'STAKEHOLDER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "Posisi" AS ENUM ('TERLENTANG', 'BERDIRI');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('HIJAU', 'KUNING', 'MERAH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RELAWAN',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "refreshToken" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "villages" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "districts" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "villages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poskos" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "villageId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poskos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balitas" (
    "id" TEXT NOT NULL,
    "namaAnak" TEXT NOT NULL,
    "namaOrtu" TEXT NOT NULL,
    "tanggalLahir" TIMESTAMP(3) NOT NULL,
    "jenisKelamin" "Gender" NOT NULL,
    "villageId" INTEGER NOT NULL,
    "poskoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" TEXT NOT NULL,
    "balitaId" TEXT NOT NULL,
    "relawanId" TEXT NOT NULL,
    "beratBadan" DOUBLE PRECISION NOT NULL,
    "tinggiBadan" DOUBLE PRECISION NOT NULL,
    "lingkarKepala" DOUBLE PRECISION NOT NULL,
    "lila" DOUBLE PRECISION NOT NULL,
    "posisiUkur" "Posisi" NOT NULL,
    "notes" TEXT,
    "sanitationData" JSONB,
    "medicalHistoryData" JSONB,
    "bb_u_status" TEXT NOT NULL,
    "tb_u_status" TEXT NOT NULL,
    "bb_tb_status" TEXT NOT NULL,
    "statusAkhir" "Status" NOT NULL,
    "isSynced" BOOLEAN NOT NULL DEFAULT true,
    "localId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- AddForeignKey
ALTER TABLE "poskos" ADD CONSTRAINT "poskos_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "villages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balitas" ADD CONSTRAINT "balitas_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "villages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balitas" ADD CONSTRAINT "balitas_poskoId_fkey" FOREIGN KEY ("poskoId") REFERENCES "poskos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_balitaId_fkey" FOREIGN KEY ("balitaId") REFERENCES "balitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_relawanId_fkey" FOREIGN KEY ("relawanId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
