import { PrismaClient, Role, Gender, Posisi, Status } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { calculateAnthropometry } from "../src/utils/zscore/calculator";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "templates");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

/**
 * Memisahkan satu baris CSV menjadi array string.
 * Mendukung nilai yang dibungkus tanda kutip ganda (quoted fields).
 */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Membaca file CSV dan mengembalikan array objek.
 * - Baris yang diawali '#' dianggap komentar dan diabaikan.
 * - Baris pertama yang bukan komentar dianggap sebagai header.
 */
function parseCSV(filePath: string): Record<string, string>[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.every((v) => v === "")) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Menghitung umur dalam bulan penuh pada tanggal tertentu */
function ageInMonths(birthDate: Date, atDate: Date): number {
  const months =
    (atDate.getFullYear() - birthDate.getFullYear()) * 12 +
    (atDate.getMonth() - birthDate.getMonth());
  return Math.max(0, months);
}

// ---------------------------------------------------------------------------
// Main Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Memulai proses seeding dari template CSV...");
  console.log(`📂 Direktori template: ${TEMPLATES_DIR}`);

  // ── 1. Bersihkan data lama ───────────────────────────────────────────────
  console.log("\n🧹 Membersihkan database...");
  try {
    await prisma.measurement.deleteMany();
    await prisma.balita.deleteMany();
    await prisma.village.deleteMany();
    await prisma.user.deleteMany();
  } catch (e) {
    console.warn("⚠️  Peringatan saat membersihkan:", e);
  }

  // ── 2. Buat Pengguna dari 01_pengguna.csv ────────────────────────────────
  console.log("\n👤 Membuat pengguna...");
  const usersData = parseCSV(join(TEMPLATES_DIR, "01_pengguna.csv"));

  if (usersData.length === 0) {
    throw new Error("❌ File 01_pengguna.csv kosong atau tidak ditemukan!");
  }

  for (const u of usersData) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: {
        name: u.nama,
        email: u.email,
        password: hashedPassword,
        role: u.role as Role,
        isVerified: u.sudah_terverifikasi.toLowerCase() === "ya",
      },
    });
  }
  console.log(`   ✅ ${usersData.length} pengguna berhasil dibuat`);

  // Peta email → userId untuk referensi pengukuran
  const userEmailMap = new Map<string, string>();
  const allUsers = await prisma.user.findMany();
  for (const u of allUsers) userEmailMap.set(u.email, u.id);

  // ── 3. Buat Desa dari 02_desa.csv ─────────────────────────────────────
  console.log("\n🏘️  Membuat data desa...");
  const villagesData = parseCSV(join(TEMPLATES_DIR, "02_desa.csv"));

  if (villagesData.length === 0) {
    throw new Error("❌ File 02_desa.csv kosong atau tidak ditemukan!");
  }

  const villageMap = new Map<string, number>(); // nama_desa → id
  for (const v of villagesData) {
    const created = await prisma.village.create({
      data: {
        name: v.nama_desa,
        districts: v.nama_kecamatan,
      },
    });
    villageMap.set(v.nama_desa, created.id);
  }
  console.log(`   ✅ ${villagesData.length} desa berhasil dibuat`);

  // ── 4. Buat Balita dari 04_balita.csv ─────────────────────────────────
  console.log("\n👶 Membuat data balita...");
  const balitaData = parseCSV(join(TEMPLATES_DIR, "04_balita.csv"));

  if (balitaData.length === 0) {
    throw new Error("❌ File 04_balita.csv kosong atau tidak ditemukan!");
  }

  const balitaMap = new Map<
    string,
    { id: string; tanggalLahir: Date; jenisKelamin: Gender }
  >();
  let balitaCreatedCount = 0;

  for (const b of balitaData) {
    const villageId = villageMap.get(b.nama_desa);
    if (!villageId) {
      console.warn(
        `   ⚠️  Desa "${b.nama_desa}" tidak ditemukan untuk balita "${b.nama_anak}", dilewati.`
      );
      continue;
    }

    const tanggalLahir = new Date(b.tanggal_lahir);

    const created = await prisma.balita.create({
      data: {
        namaAnak: b.nama_anak,
        namaOrtu: b.nama_ortu,
        tanggalLahir,
        jenisKelamin: b.jenis_kelamin as Gender,
        villageId,
      },
    });

    balitaMap.set(b.nama_anak, {
      id: created.id,
      tanggalLahir,
      jenisKelamin: b.jenis_kelamin as Gender,
    });
    balitaCreatedCount++;
  }
  console.log(`   ✅ ${balitaCreatedCount} balita berhasil dibuat`);

  // ── 6. Buat Pengukuran dari 05_pengukuran.csv ─────────────────────────
  console.log("\n📏 Membuat data pengukuran...");
  const measurementsData = parseCSV(join(TEMPLATES_DIR, "05_pengukuran.csv"));

  if (measurementsData.length === 0) {
    console.warn(
      "   ⚠️  File 05_pengukuran.csv kosong. Tidak ada pengukuran yang dibuat."
    );
  }

  let measCount = 0;
  let measSkipped = 0;

  for (const m of measurementsData) {
    const balitaRef = balitaMap.get(m.nama_anak);
    if (!balitaRef) {
      console.warn(
        `   ⚠️  Balita "${m.nama_anak}" tidak ditemukan, pengukuran dilewati.`
      );
      measSkipped++;
      continue;
    }

    const relawanId = userEmailMap.get(m.email_relawan);
    if (!relawanId) {
      console.warn(
        `   ⚠️  Relawan "${m.email_relawan}" tidak ditemukan, pengukuran dilewati.`
      );
      measSkipped++;
      continue;
    }

    const measDate = new Date(m.tanggal_pengukuran);
    const months = ageInMonths(balitaRef.tanggalLahir, measDate);

    const bb = parseFloat(m.berat_badan_kg);
    const tb = parseFloat(m.tinggi_badan_cm);
    const lk = parseFloat(m.lingkar_kepala_cm);
    const lila = parseFloat(m.lila_cm);

    const result = calculateAnthropometry(
      months,
      bb,
      tb,
      lk,
      lila,
      balitaRef.jenisKelamin
    );

    // Posisi ukur: gunakan nilai dari CSV jika ada, atau hitung otomatis dari usia
    let posisiUkur: Posisi;
    if (m.posisi_ukur && m.posisi_ukur.trim() !== "") {
      posisiUkur = m.posisi_ukur.toUpperCase() as Posisi;
    } else {
      posisiUkur = months < 24 ? Posisi.TERLENTANG : Posisi.BERDIRI;
    }

    await prisma.measurement.create({
      data: {
        balitaId: balitaRef.id,
        relawanId,
        beratBadan: bb,
        tinggiBadan: tb,
        lingkarKepala: lk,
        lila,
        posisiUkur,
        bb_u_status: result.bb_u_status,
        tb_u_status: result.tb_u_status,
        bb_tb_status: result.bb_tb_status,
        lk_u_status: result.lk_u_status,
        lila_u_status: result.lila_u_status,
        imt_u_status: result.imt_u_status,
        statusAkhir: result.statusAkhir as Status,
        isSynced: true,
        createdAt: measDate,
        updatedAt: measDate,
      },
    });
    measCount++;
  }

  console.log(
    `   ✅ ${measCount} pengukuran berhasil dibuat` +
      (measSkipped > 0
        ? ` (${measSkipped} dilewati karena data tidak valid)`
        : "")
  );

  // ── Ringkasan ─────────────────────────────────────────────────────────
  console.log("\n============================================");
  console.log("✅ Seeding selesai!");
  console.log(`   👤 Pengguna    : ${await prisma.user.count()}`);
  console.log(`   🏘️  Desa        : ${await prisma.village.count()}`);
  console.log(`   👶 Balita      : ${await prisma.balita.count()}`);
  console.log(`   📏 Pengukuran  : ${await prisma.measurement.count()}`);
  console.log("============================================");
}

main()
  .catch((e) => {
    console.error("❌ Seeding gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
