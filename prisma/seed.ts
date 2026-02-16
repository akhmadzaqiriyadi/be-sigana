import {
  PrismaClient,
  Role,
  Gender,
  Posisi,
  Status,
  Village,
  Posko,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { fakerID_ID as faker } from "@faker-js/faker";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import fs from "fs";
import path from "path";

config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helper to parse CSV manually due to mixed quoting and simple structure
function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xfeff) {
    lines[0] = lines[0].slice(1);
  }

  const result: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current.trim().replace(/^"|"$/g, ""));
    result.push(row);
  }

  return result;
}

function parseNumber(val: string | undefined): number | null {
  if (!val || val === "-" || val === "") return null;
  // Handle "3,8" -> 3.8
  const clean = val.replace(",", ".").replace(/[^\d.]/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function parseDate(val: string): Date | null {
  if (!val || val === "-" || val === "") return null;

  // Try DD-MM-YYYY or DD/MM/YYYY
  const parts = val.split(/[-/]/);
  if (parts.length === 3) {
    // Check if parts[2] is year (4 digits)
    if (parts[2].length === 4) {
      // DD-MM-YYYY
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    // Handle YYYY-MM-DD just in case
    if (parts[0].length === 4) {
      return new Date(val);
    }
  }
  return null;
}

interface MeasurementData {
  beratBadan: number | null;
  tinggiBadan: number | null;
  lingkarKepala: number | null;
  lila: number | null;
  notes?: string;
}

interface BalitaDTO {
  namaAnak: string;
  namaOrtu: string;
  tanggalLahir: Date;
  jenisKelamin: Gender;
  villageId: number;
  poskoId: number | null;
  measurements: MeasurementData[];
}

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Clean up database
  console.log("🧹 Cleaning database...");
  try {
    await prisma.measurement.deleteMany();
    await prisma.balita.deleteMany();
    await prisma.posko.deleteMany();
    await prisma.village.deleteMany();
    await prisma.user.deleteMany();
  } catch (e) {
    console.warn("⚠️ Warning during cleanup:", e);
  }

  // 2. Create Users
  console.log("👤 Creating users...");
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash("password123", salt);

  const users = [
    {
      name: "Admin SiGana",
      email: "admin@sigana.id",
      role: Role.ADMIN,
      password,
      isVerified: true,
    },
    {
      name: "Budi Santoso",
      email: "relawan@sigana.id",
      role: Role.RELAWAN,
      password,
      isVerified: true,
    },
    {
      name: "Siti Aminah",
      email: "relawan2@sigana.id",
      role: Role.RELAWAN,
      password,
      isVerified: true,
    },
    {
      name: "Dinas Kesehatan Cianjur",
      email: "dinkes@sigana.id",
      role: Role.STAKEHOLDER,
      password,
      isVerified: true,
    },
  ];

  for (const user of users) {
    await prisma.user.create({ data: user });
  }

  const relawanUser = await prisma.user.findUnique({
    where: { email: "relawan@sigana.id" },
  });

  if (!relawanUser) {
    throw new Error("Relawan user not found after creation");
  }

  // 3. Create Villages
  console.log("🏘️ Creating villages...");
  const villageNames = [
    { name: "Sukamaju", districts: "Cianjur" },
    { name: "Mekarwangi", districts: "Warungkondang" },
    { name: "Cijedil", districts: "Cugenang" },
    { name: "Cibadak", districts: "Cibeber" },
    { name: "Cirumput", districts: "Cugenang" },
  ];

  const villages: Village[] = [];
  for (const v of villageNames) {
    const village = await prisma.village.create({
      data: v,
    });
    villages.push(village);
  }

  // 4. Create Poskos
  console.log("camp Creating poskos...");
  const poskos: Posko[] = [];
  for (const village of villages) {
    const numPoskos = faker.number.int({ min: 1, max: 2 });
    for (let i = 0; i < numPoskos; i++) {
      const posko = await prisma.posko.create({
        data: {
          name: `Posko ${village.name} ${i + 1}`,
          villageId: village.id,
          latitude: faker.location.latitude({ max: -6.7, min: -7.0 }),
          longitude: faker.location.longitude({ max: 107.2, min: 107.0 }),
        },
      });
      poskos.push(posko);
    }
  }

  // Helper to get random village/posko
  const getRandomVillagePosko = () => {
    const village = faker.helpers.arrayElement(villages);
    const availablePoskos = poskos.filter((p) => p.villageId === village.id);
    const posko =
      availablePoskos.length > 0
        ? faker.helpers.arrayElement(availablePoskos)
        : null;
    return { village, posko };
  };

  // 5. Process CSV Data
  console.log("📊 Processing CSV data...");

  const csvFile1Path = path.join(
    process.cwd(),
    "Database Pasien Gizi - Data Baru.csv"
  );
  const csvFile2Path = path.join(
    process.cwd(),
    "Database Pasien Gizi - Data Pasien dan Pengukuran.csv"
  );

  const balitaMap = new Map<string, BalitaDTO>();

  // Read File 1: Data Baru
  if (fs.existsSync(csvFile1Path)) {
    console.log(`Processing: ${csvFile1Path}`);
    const content = fs.readFileSync(csvFile1Path, "utf-8");
    const rows = parseCSV(content);

    // Skip header
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 3) continue;

      const tglLahirStr = row[1];
      const namaAnak = row[2];
      const beratStr = row[4];
      const panjangStr = row[5];
      const lingkarKepalaStr = row[6];
      const namaOrtu = row[7];

      const tanggalLahir = parseDate(tglLahirStr);
      if (!tanggalLahir || !namaAnak || namaAnak === "-") continue;

      const key = `${namaAnak.toLowerCase().trim()}_${tanggalLahir.getTime()}`;

      const berat = parseNumber(beratStr);
      const tinggi = parseNumber(panjangStr);
      const lingkarKepala = parseNumber(lingkarKepalaStr);

      const { village, posko } = getRandomVillagePosko();

      balitaMap.set(key, {
        namaAnak,
        namaOrtu: namaOrtu || `Orang Tua ${namaAnak}`,
        tanggalLahir,
        jenisKelamin: faker.helpers.arrayElement([Gender.L, Gender.P]),
        villageId: village.id,
        poskoId: posko ? posko.id : null,
        measurements: [
          {
            beratBadan: berat,
            tinggiBadan: tinggi,
            lingkarKepala,
            lila: null,
            notes: "Sumber: Data Baru.csv",
          },
        ],
      });
    }
  }

  // Read File 2: Data Pasien dan Pengukuran
  if (fs.existsSync(csvFile2Path)) {
    console.log(`Processing: ${csvFile2Path}`);
    const content = fs.readFileSync(csvFile2Path, "utf-8");
    const rows = parseCSV(content);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 4) continue;

      const nik = row[1];
      const namaAnak = row[2];
      const tglLahirStr = row[3];
      const beratStr = row[4];
      const tinggiStr = row[5];
      const lilaStr = row[6];
      const lingkarKepalaStr = row[7];
      const keterangan = row[8];

      const tanggalLahir = parseDate(tglLahirStr);
      if (!tanggalLahir || !namaAnak || namaAnak === "-") continue;

      const key = `${namaAnak.toLowerCase().trim()}_${tanggalLahir.getTime()}`;

      const berat = parseNumber(beratStr);
      const tinggi = parseNumber(tinggiStr);
      const lila = parseNumber(lilaStr);
      const lingkarKepala = parseNumber(lingkarKepalaStr);

      if (balitaMap.has(key)) {
        const existing = balitaMap.get(key)!;
        existing.measurements.push({
          beratBadan: berat,
          tinggiBadan: tinggi,
          lila,
          lingkarKepala,
          notes: `Sumber: Data Pasien. NIK: ${nik}. ${keterangan || ""}`,
        });
      } else {
        const { village, posko } = getRandomVillagePosko();
        balitaMap.set(key, {
          namaAnak,
          namaOrtu: `Orang Tua ${namaAnak}`,
          tanggalLahir,
          jenisKelamin: faker.helpers.arrayElement([Gender.L, Gender.P]),
          villageId: village.id,
          poskoId: posko ? posko.id : null,
          measurements: [
            {
              beratBadan: berat,
              tinggiBadan: tinggi,
              lila,
              lingkarKepala,
              notes: `Sumber: Data Pasien. NIK: ${nik}. ${keterangan || ""}`,
            },
          ],
        });
      }
    }
  }

  // 6. Insert Balitas
  console.log(`👶 Found ${balitaMap.size} unique balitas. Inserting...`);

  for (const data of balitaMap.values()) {
    if (!data.namaAnak) continue;

    const balita = await prisma.balita.create({
      data: {
        namaAnak: data.namaAnak,
        namaOrtu: data.namaOrtu,
        tanggalLahir: data.tanggalLahir,
        jenisKelamin: data.jenisKelamin,
        villageId: data.villageId,
        poskoId: data.poskoId,
      },
    });

    for (const meas of data.measurements) {
      if (!meas.beratBadan && !meas.tinggiBadan) continue;

      const ageMonths =
        (new Date().getTime() - data.tanggalLahir.getTime()) /
        (1000 * 60 * 60 * 24 * 30.44);

      await prisma.measurement.create({
        data: {
          balitaId: balita.id,
          relawanId: relawanUser.id,
          beratBadan: meas.beratBadan || 0,
          tinggiBadan: meas.tinggiBadan || 0,
          lingkarKepala: meas.lingkarKepala || 0,
          lila: meas.lila || 0,
          posisiUkur: ageMonths < 24 ? Posisi.TERLENTANG : Posisi.BERDIRI,
          bb_u_status: faker.helpers.arrayElement([
            "Gizi Baik",
            "Kurang Gizi",
            "Gizi Lebih",
          ]),
          tb_u_status: faker.helpers.arrayElement([
            "Normal",
            "Pendek",
            "Sangat Pendek",
          ]),
          bb_tb_status: faker.helpers.arrayElement([
            "Gizi Baik",
            "Gizi Kurang",
            "Gizi Buruk",
            "Berisiko Gizi Lebih",
          ]),
          statusAkhir: faker.helpers.arrayElement(Object.values(Status)),
          notes: meas.notes,
        },
      });
    }
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
