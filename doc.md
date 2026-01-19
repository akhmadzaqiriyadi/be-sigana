# 📑 Blue Print Sistem SiGana (Sistem Gizi Bencana) - Versi 1.0 (MVP)

Dokumen ini merangkum seluruh spesifikasi teknis, arsitektur, dan alur kerja untuk pengembangan aplikasi pemantauan gizi pascabencana dalam jangka waktu 1 bulan.

---

## 1. Arsitektur Sistem & Tech Stack

Aplikasi ini dibangun menggunakan pendekatan **Progressive Web App (PWA)** dengan prinsip **Offline-First** untuk memastikan operasional tetap berjalan di medan bencana yang minim sinyal.

| Komponen | Teknologi | Alasan / Fungsi |
|----------|-----------|-----------------|
| Frontend | Next.js (React) + TypeScript | Cepat (SSR/ISR), type-safe, dan ringan untuk HP RAM 2GB. |
| Styling | Tailwind CSS | Pengembangan UI mobile-first yang cepat dan responsif. |
| Offline Storage | IndexedDB (via Dexie.js) | Menyimpan data antropometri secara lokal saat sinyal hilang. |
| Backend | Node.js (Next.js API Routes) | Integrasi mulus dengan frontend dalam satu codebase. |
| Database | PostgreSQL / MySQL (via Prisma) | Database relasional untuk integritas data yang tinggi. |
| PWA Features | Service Workers & Manifest | Memungkinkan instalasi di HP dan akses offline assets. |

---

## 2. Skema Database Ter-Normalisasi (Prisma Schema)

Skema ini mencakup pemisahan wilayah, koordinat geografis (geo-tagging), dan pelacakan audit sinkronisasi.

```prisma
// --- SISTEM SIGANA DATABASE SCHEMA ---

// 1. Manajemen Pengguna & Akses
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  password      String
  name          String
  role          Role      @default(RELAWAN)
  isVerified    Boolean   @default(false)   // Verifikasi oleh Admin
  measurements  Measurement[]
  createdAt     DateTime  @default(now())
}

enum Role {
  RELAWAN
  ADMIN
  STAKEHOLDER
}

// 2. Normalisasi Wilayah & Geo-Location
model Village {
  id          Int       @id @default(autoincrement())
  name        String    // Nama Desa
  districts   String    // Nama Kecamatan
  poskos      Posko[]
  balitas     Balita[]
}

model Posko {
  id          Int       @id @default(autoincrement())
  name        String    // Contoh: "Tenda Pengungsian Lapangan Guntur"
  villageId   Int
  village     Village   @relation(fields: [villageId], references: [id])
  latitude    Float?    // Koordinat untuk Peta Sebaran
  longitude   Float?    
  balitas     Balita[]
}

// 3. Data Master Balita (Induk)
model Balita {
  id            String    @id @default(uuid())
  namaAnak      String
  namaOrtu      String
  tanggalLahir  DateTime  // Untuk hitung Umur Bulan otomatis
  jenisKelamin  Gender
  villageId     Int
  village       Village   @relation(fields: [villageId], references: [id])
  poskoId       Int?
  posko         Posko?    @relation(fields: [poskoId], references: [id])
  measurements  Measurement[]
  createdAt     DateTime  @default(now())
}

enum Gender {
  L
  P
}

// 4. Data Transaksi Pengukuran (Antropometri)
model Measurement {
  id                String    @id @default(uuid())
  balitaId          String
  balita            Balita    @relation(fields: [balitaId], references: [id])
  relawanId         String
  relawan           User      @relation(fields: [relawanId], references: [id])
  
  // Input Fisik
  beratBadan        Float
  tinggiBadan       Float
  lingkarKepala     Float
  lila              Float
  posisiUkur        Posisi    // TERLENTANG / BERDIRI
  
  // Output Z-Score (Permenkes 2/2020)
  bb_u_status       String
  tb_u_status       String
  bb_tb_status      String
  statusAkhir       Status    // HIJAU (Aman), KUNING (Waspada), MERAH (Bahaya)
  
  // Mekanisme Sync PWA
  isSynced          Boolean   @default(true)
  localId           String?   // ID dari IndexedDB untuk rekonsiliasi data
  
  createdAt         DateTime  @default(now())
}

enum Posisi { TERLENTANG; BERDIRI }
enum Status { HIJAU; KUNING; MERAH }
```

---

## 3. POV User Flow (Lengkap & Terintegrasi)

### A. POV Relawan (User Lapangan)

1. **Onboarding:** Buka URL → Daftar Akun → Tunggu Aktivasi Admin.

2. **Setup Offline:** Saat ada sinyal, sistem mengunduh data Master Wilayah (Desa/Posko) ke IndexedDB.

3. **Penyisiran Lapangan:**
   - Relawan masuk ke tenda/posko.
   - Buka form "Input Baru" (bisa diakses tanpa internet).
   - Pilih Desa/Posko dari dropdown (data dari IndexedDB).
   - Input Identitas & Data Fisik Balita.

4. **Analisis Seketika:** Klik "Analisis", sistem menjalankan fungsi Z-Score lokal. Muncul kartu hasil (Merah/Kuning/Hijau).

5. **Intervensi Darurat:** Jika Merah, klik "Kirim WA" atau "Download PDF" rujukan untuk orang tua.

6. **Sinkronisasi:** Saat relawan kembali ke posko utama yang ada internet, sistem mendeteksi koneksi dan mengunggah semua data `isSynced: false`.

---

### B. POV Admin / Bidan (Verifikator)

1. **Gatekeeping:** Melakukan review pada pendaftar relawan baru (menghindari data sampah).

2. **Quality Control:** Membuka tabel master data, memverifikasi jika ada angka antropometri yang tidak masuk akal (misal: BB 50kg untuk balita), dan melakukan koreksi.

3. **Master Data Management:** Menambah atau mengedit daftar Posko jika titik pengungsian bertambah.

---

### C. POV Stakeholder (Dinas/Donatur)

1. **Monitoring Real-time:** Membuka Dashboard Executive.

2. **Spasial Analisis:** Melihat peta sebaran (Google Maps/Leaflet) berdasarkan koordinat Posko. Titik merah yang padat menjadi prioritas pengiriman logistik susu/makanan tambahan (PMT).

3. **Reporting:** Klik "Export CSV" untuk kebutuhan pelaporan birokrasi atau pengajuan dana darurat.

---

## 4. Mekanisme Offline-First (PWA Strategy)

Untuk mencapai reliabilitas 100% tanpa kehilangan data:

| Fitur | Deskripsi |
|-------|-----------|
| **Service Worker** | Melakukan caching pada file `.js`, `.css`, dan `.html` agar aplikasi bisa dibuka meski HP dalam mode pesawat. |
| **Background Sync** | Menggunakan API browser untuk mencoba mengirim data kembali secara otomatis saat terhubung ke internet. |
| **Conflict Resolution** | Jika data sudah ada di server (cek via `localId`), server akan melakukan update bukan duplicate. |

---

## 5. Roadmap Pengembangan (1 Bulan)

| Minggu | Milestone | Output Utama |
|--------|-----------|--------------|
| **Minggu 1** | Core & Database | Boilerplate Next.js, Prisma Schema, Auth System, Landing Page. |
| **Minggu 2** | PWA & Offline Form | Manifest PWA, IndexedDB Setup, Form Antropometri Mobile-Optimized. |
| **Minggu 3** | Logic & Output | Z-Score Algorithm (TS), PDF Generator, WA Integration, Local Analysis. |
| **Minggu 4** | Dashboard & Deploy | Stakeholder Charts, Geo-tagging Maps, Export CSV, Cloud Deployment. |

---

> **Catatan Akhir:** Setiap modul dirancang independen namun terhubung melalui UUID. Fokus utama pengembangan minggu pertama adalah memastikan skema database di atas ter-migrasi dengan sempurna ke server.