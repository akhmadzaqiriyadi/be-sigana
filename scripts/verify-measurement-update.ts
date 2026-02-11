/* eslint-disable */
import { prisma } from "../src/config/db";
import { measurementService } from "../src/modules/measurement/measurement.service";
import { balitaService } from "../src/modules/balita/balita.service";
import { Gender, Posisi } from "@prisma/client";

async function verify() {
  console.log("🚀 Starting Verification...");

  // 1. Setup Data
  console.log("\n1. Setting up test data...");
  const village = await prisma.village.findFirst();
  if (!village) throw new Error("No village found. Please seed db.");

  const testBalita = await prisma.balita.create({
    data: {
      namaAnak: "Test Balita Auto",
      namaOrtu: "Test Ortu Auto",
      tanggalLahir: new Date("2023-01-01"),
      jenisKelamin: Gender.L,
      villageId: village.id,
    },
  });
  console.log("✅ Created Test Balita:", testBalita.id);

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) throw new Error("No admin user found.");

  // 2. Test Create Measurement with JSON Data
  console.log("\n2. Testing Create Measurement with JSON Data...");
  const sanitationData = {
    version: 1,
    answers: {
      q_air_bersih: true,
      q_jamban_sehat: false,
    },
  };

  const medicalHistoryData = {
    version: 1,
    answers: {
      q_asi_eksklusif: true,
      q_imunisasi: "Lengkap",
    },
  };

  const measurement = await measurementService.create({
    balitaId: testBalita.id,
    relawanId: adminUser.id,
    beratBadan: 10,
    tinggiBadan: 80,
    lingkarKepala: 45,
    lila: 15,
    posisiUkur: Posisi.TERLENTANG,
    notes: "Test measurement notes",
    sanitationData,
    medicalHistoryData,
  });

  if (
    measurement.notes === "Test measurement notes" &&
    (measurement.sanitationData as any).answers.q_air_bersih === true &&
    (measurement.medicalHistoryData as any).answers.q_imunisasi === "Lengkap"
  ) {
    console.log("✅ Measurement created with JSON data correctly.");
  } else {
    console.error("❌ Failed to save JSON data correctly:", measurement);
  }

  // 3. Test Search Balita
  console.log("\n3. Testing Search Balita...");
  const searchResult = await balitaService.findAll(1, 10, {
    search: "Balita Auto",
  });

  if (
    searchResult.balitas.length > 0 &&
    searchResult.balitas[0].id === testBalita.id
  ) {
    console.log("✅ Search by name successful.");
  } else {
    console.error("❌ Search failed. Found:", searchResult.balitas.length);
  }

  // Cleanup
  console.log("\nCleaning up...");
  await prisma.measurement.delete({ where: { id: measurement.id } });
  await prisma.balita.delete({ where: { id: testBalita.id } });
  console.log("✅ Cleanup done.");
}

verify()
  .catch((e) => {
    console.error("❌ Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
