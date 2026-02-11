import { PrismaClient, Role, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // Create Admin user
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@sigana.id" },
    update: {},
    create: {
      email: "admin@sigana.id",
      password: adminPassword,
      name: "Admin SiGana",
      role: Role.ADMIN,
      isVerified: true,
    },
  });
  console.log("✅ Admin created:", admin.email);

  // Create sample Relawan
  const relawanPassword = await bcrypt.hash("relawan123", 12);
  const relawan = await prisma.user.upsert({
    where: { email: "relawan@sigana.id" },
    update: {},
    create: {
      email: "relawan@sigana.id",
      password: relawanPassword,
      name: "Relawan Demo",
      role: Role.RELAWAN,
      isVerified: true,
    },
  });
  console.log("✅ Relawan created:", relawan.email);

  // Create sample Stakeholder
  const stakeholderPassword = await bcrypt.hash("stakeholder123", 12);
  const stakeholder = await prisma.user.upsert({
    where: { email: "stakeholder@sigana.id" },
    update: {},
    create: {
      email: "stakeholder@sigana.id",
      password: stakeholderPassword,
      name: "Dinas Kesehatan",
      role: Role.STAKEHOLDER,
      isVerified: true,
    },
  });
  console.log("✅ Stakeholder created:", stakeholder.email);

  // Create sample Villages
  const villages = await Promise.all([
    prisma.village.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: "Desa Sukamaju",
        districts: "Kecamatan Cianjur",
      },
    }),
    prisma.village.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: "Desa Mekarjaya",
        districts: "Kecamatan Cianjur",
      },
    }),
  ]);
  console.log("✅ Villages created:", villages.length);

  // Create sample Poskos
  const poskos = await Promise.all([
    prisma.posko.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: "Posko Lapangan Sukamaju",
        villageId: villages[0].id,
        latitude: -6.8213,
        longitude: 107.1338,
      },
    }),
    prisma.posko.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: "Posko Mesjid Al-Ikhlas",
        villageId: villages[0].id,
        latitude: -6.8225,
        longitude: 107.1345,
      },
    }),
    prisma.posko.upsert({
      where: { id: 3 },
      update: {},
      create: {
        name: "Posko Balai Desa Mekarjaya",
        villageId: villages[1].id,
        latitude: -6.8301,
        longitude: 107.1401,
      },
    }),
  ]);
  console.log("✅ Poskos created:", poskos.length);

  // Create sample Balitas
  const balitas = await Promise.all([
    prisma.balita.upsert({
      where: { id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" },
      update: {},
      create: {
        id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        namaAnak: "Ahmad Fauzi",
        namaOrtu: "Bapak Fauzi",
        tanggalLahir: new Date("2023-06-15"),
        jenisKelamin: Gender.L,
        villageId: villages[0].id,
        poskoId: poskos[0].id,
      },
    }),
    prisma.balita.upsert({
      where: { id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e" },
      update: {},
      create: {
        id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        namaAnak: "Siti Aisyah",
        namaOrtu: "Ibu Aisyah",
        tanggalLahir: new Date("2022-03-20"),
        jenisKelamin: Gender.P,
        villageId: villages[0].id,
        poskoId: poskos[1].id,
      },
    }),
    prisma.balita.upsert({
      where: { id: "d8fa3980-dd84-4120-bb2a-3dc66440efb6" },
      update: {},
      create: {
        id: "d8fa3980-dd84-4120-bb2a-3dc66440efb6",
        namaAnak: "Rizki Pratama",
        namaOrtu: "Bapak Pratama",
        tanggalLahir: new Date("2024-01-10"),
        jenisKelamin: Gender.L,
        villageId: villages[1].id,
        poskoId: poskos[2].id,
      },
    }),
  ]);
  console.log("✅ Balitas created:", balitas.length);

  // Create Relawan Senior (Simulasi User aktif dengan history)
  const relawanSeniorPassword = await bcrypt.hash("senior123", 12);
  const relawanSenior = await prisma.user.upsert({
    where: { email: "senior@sigana.id" },
    update: {},
    create: {
      email: "senior@sigana.id",
      password: relawanSeniorPassword,
      name: "Relawan Senior",
      role: Role.RELAWAN,
      isVerified: true,
    },
  });
  console.log("✅ Relawan Senior created:", relawanSenior.email);

  // Create Measurements (Riwayat Pengecekan)
  // Clean existing measurements for idempotency if needed, or just create new ones strictly
  // but existing DB might prevent dupes if IDs clash. upsert is better if we have fixed IDs.

  const measurements = await Promise.all([
    prisma.measurement.upsert({
      where: { id: "meas-1" },
      update: {},
      create: {
        id: "meas-1",
        balitaId: balitas[0].id, // Ahmad Fauzi
        relawanId: relawanSenior.id,
        beratBadan: 8.5,
        tinggiBadan: 71.0,
        lingkarKepala: 44.0,
        lila: 14.0,
        posisiUkur: "TERLENTANG",
        bb_u_status: "Gizi Baik",
        tb_u_status: "Normal",
        bb_tb_status: "Gizi Baik",
        statusAkhir: "HIJAU",
        isSynced: true,
        createdAt: new Date("2024-01-15T09:00:00Z"),
        notes: "Anak sehat, aktif.",
        sanitationData: {
          version: 1,
          answers: {
            q_air_bersih: true,
            q_jamban_sehat: true,
          },
        },
        medicalHistoryData: {
          version: 1,
          answers: {
            q_asi_eksklusif: true,
            q_imunisasi: "Lengkap",
          },
        },
      },
    }),
    prisma.measurement.upsert({
      where: { id: "meas-2" },
      update: {},
      create: {
        id: "meas-2",
        balitaId: balitas[1].id, // Siti Aisyah
        relawanId: relawanSenior.id,
        beratBadan: 11.2,
        tinggiBadan: 85.0,
        lingkarKepala: 47.0,
        lila: 15.5,
        posisiUkur: "BERDIRI",
        bb_u_status: "Risiko Gizi Lebih",
        tb_u_status: "Normal",
        bb_tb_status: "Gizi Baik",
        statusAkhir: "KUNING",
        isSynced: true,
        createdAt: new Date("2024-01-16T10:30:00Z"),
        notes: "Perlu pemantauan gizi lebih ketat.",
        sanitationData: {
          version: 1,
          answers: {
            q_air_bersih: false,
            q_jamban_sehat: true,
          },
        },
        medicalHistoryData: {
          version: 1,
          answers: {
            q_asi_eksklusif: false,
            q_imunisasi: "Belum Lengkap",
          },
        },
      },
    }),
    prisma.measurement.upsert({
      where: { id: "meas-3" },
      update: {},
      create: {
        id: "meas-3",
        balitaId: balitas[0].id, // Ahmad Fauzi (Check ke-2)
        relawanId: relawanSenior.id,
        beratBadan: 8.9,
        tinggiBadan: 73.0,
        lingkarKepala: 44.5,
        lila: 14.2,
        posisiUkur: "TERLENTANG",
        bb_u_status: "Gizi Baik",
        tb_u_status: "Normal",
        bb_tb_status: "Gizi Baik",
        statusAkhir: "HIJAU",
        isSynced: true,
        createdAt: new Date("2024-02-15T09:15:00Z"),
        notes: "Kondisi stabil.",
        sanitationData: {
          version: 1,
          answers: {
            q_air_bersih: true,
            q_jamban_sehat: true,
          },
        },
        medicalHistoryData: {
          version: 1,
          answers: {
            q_asi_eksklusif: true,
            q_imunisasi: "Lengkap",
          },
        },
      },
    }),
  ]);
  console.log("✅ Measurements created:", measurements.length);

  console.log("🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
