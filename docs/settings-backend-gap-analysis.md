# Backend Gap Analysis — Admin > Pengaturan (Settings)

> **Tanggal**: 2025-07-13  
> **Scope**: Seluruh sub-section pada halaman `/admin/pengaturan` di `fe-sigana`  
> **Backend base URL**: `/api/v1/`  
> **Backend stack**: Express.js + TypeScript + Prisma ORM + PostgreSQL

---

## Ringkasan Eksekutif

Dari **6 sub-section** pada halaman Pengaturan, hanya **1 sub-section** (Konfigurasi Wilayah) yang memiliki dukungan backend parsial. Lima sub-section lainnya belum memiliki model Prisma, modul, maupun endpoint sama sekali.

| Sub-Section                   | Status Backend | Modul Ada?                 | Model Prisma?                |
| ----------------------------- | -------------- | -------------------------- | ---------------------------- |
| Konfigurasi Wilayah           | ⚠️ Parsial     | ✅ `village`               | ✅ `Village` (tidak lengkap) |
| Tabel Referensi KBM           | ❌ Tidak ada   | ❌                         | ❌                           |
| Pengaturan Threshold Analisis | ❌ Tidak ada   | ❌                         | ❌                           |
| Status Badge Color System     | ❌ Tidak ada   | ❌                         | ❌                           |
| WHO Growth Standard Dataset   | ❌ Tidak ada   | ❌                         | ❌                           |
| Informasi Sistem              | ⚠️ Parsial     | ❌ (hanya `/health` dasar) | ❌                           |
| Pengaturan Akses Sistem       | ❌ Tidak ada   | ❌                         | ❌                           |

---

## 1. Konfigurasi Wilayah

### Status: ⚠️ Parsial — Ada tapi tidak lengkap

### Yang sudah ada

Modul `village` sudah lengkap untuk operasi CRUD desa:

```
GET    /api/v1/villages                    → semua desa
GET    /api/v1/villages/:id                → desa by ID
GET    /api/v1/villages/kecamatan          → distinct list kecamatan (string)
GET    /api/v1/villages/kecamatan/:name    → desa by kecamatan
POST   /api/v1/villages                    → tambah desa (ADMIN)
PUT    /api/v1/villages/:id                → edit desa (ADMIN)
DELETE /api/v1/villages/:id                → hapus desa (ADMIN)
```

### Gap yang ditemukan

#### 1.1 Tidak ada field `isActive` pada model `Village`

Model `Village` saat ini:

```prisma
model Village {
  id        Int     @id @default(autoincrement())
  name      String
  districts String
  latitude  Float?
  longitude Float?
  balitas   Balita[]
}
```

Frontend menampilkan badge "Aktif" / "Non-Aktif" untuk setiap desa, namun backend tidak bisa menyimpan status ini.

**Perbaikan yang diperlukan:**

```prisma
model Village {
  id        Int     @id @default(autoincrement())
  name      String
  districts String
  latitude  Float?
  longitude Float?
  isActive  Boolean @default(true)   // ← tambahkan ini
  balitas   Balita[]
}
```

#### 1.2 Validasi `createVillageSchema` tidak menerima `latitude`/`longitude`

Saat ini `createVillageSchema` (di `src/validations/master.validation.ts`) hanya menerima `name` dan `districts`:

```ts
body: z.object({
  name: z.string().min(3),
  districts: z.string().min(3),
});
```

Frontend mengirimkan `latitude`, `longitude`, dan `isActive` saat membuat/mengedit desa.

**Perbaikan yang diperlukan:**

```ts
body: z.object({
  name: z.string().min(3),
  districts: z.string().min(3),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isActive: z.boolean().optional(),
});
```

#### 1.3 Tidak ada model `Kecamatan` yang independen

Frontend memiliki tabel Kecamatan tersendiri dengan operasi Tambah/Edit/Hapus/Toggle Status. Namun di backend, `districts` hanya berupa `String` di model `Village`. Operasi pada Kecamatan tidak bisa dilakukan tanpa merombak semua desa terkait.

**Solusi arsitektur yang direkomendasikan:**

```prisma
model Kecamatan {
  id       Int       @id @default(autoincrement())
  name     String    @unique
  isActive Boolean   @default(true)
  villages Village[]
}

model Village {
  id           Int        @id @default(autoincrement())
  name         String
  kecamatanId  Int
  kecamatan    Kecamatan  @relation(fields: [kecamatanId], references: [id])
  latitude     Float?
  longitude    Float?
  isActive     Boolean    @default(true)
  balitas      Balita[]
}
```

**Endpoint baru yang diperlukan untuk Kecamatan:**

```
GET    /api/v1/kecamatan          → semua kecamatan
POST   /api/v1/kecamatan          → tambah kecamatan (ADMIN)
PUT    /api/v1/kecamatan/:id      → edit kecamatan (ADMIN)
DELETE /api/v1/kecamatan/:id      → hapus kecamatan (ADMIN)
PATCH  /api/v1/kecamatan/:id/toggle-status  → toggle aktif/non-aktif (ADMIN)
```

---

## 2. Tabel Referensi KBM

### Status: ❌ Tidak ada sama sekali

### Deskripsi frontend

Halaman ini menampilkan tabel nilai KBM Minimal per usia (bulan 0–60), dengan kemampuan inline-edit nilai per baris. Data saat ini 100% hardcoded di frontend (`generateKbmData()`).

### Gap

- Tidak ada model `Kbm` di Prisma schema
- Tidak ada modul `kbm` di `src/modules/`
- Tidak ada endpoint terkait KBM

### Schema yang diperlukan

```prisma
model KbmReference {
  id         Int      @id @default(autoincrement())
  usiaBulan  Int      @unique  // 0–60
  kbmMinimal Int
  updatedAt  DateTime @updatedAt
  updatedBy  String?
}
```

### Endpoint yang diperlukan

```
GET  /api/v1/kbm          → semua referensi KBM (semua role)
PUT  /api/v1/kbm/:id      → update nilai KBM per baris (ADMIN only)
```

**Request body `PUT /api/v1/kbm/:id`:**

```json
{
  "kbmMinimal": 7500
}
```

**Response `GET /api/v1/kbm`:**

```json
[
  { "id": 1, "usiaBulan": 0, "kbmMinimal": 4200, "updatedAt": "2025-01-01T00:00:00Z" },
  { "id": 2, "usiaBulan": 1, "kbmMinimal": 4500, "updatedAt": "2025-01-01T00:00:00Z" },
  ...
]
```

> **Catatan**: Data awal dapat di-seed dari tabel referensi KBM Kemenkes RI (Buku KIA).

---

## 3. Pengaturan Threshold Analisis

### Status: ❌ Tidak ada sama sekali

### Deskripsi frontend

Pengaturan ini mengontrol logika klasifikasi status gizi:

- **Min. Data Point**: jumlah minimal pengukuran sebelum analisis dilakukan
- **Warning Enabled**: apakah level peringatan (kuning) aktif
- **Faltering Threshold**: ambang batas konsekutif untuk kondisi faltering
- **Badge Colors**: warna untuk setiap kategori status (Normal/Peringatan/Faltering/Gizi Buruk)

### Gap

- Tidak ada model untuk menyimpan konfigurasi sistem
- Semua nilai threshold hardcoded di frontend

### Schema yang diperlukan

```prisma
model SystemConfig {
  id    String @id  // key, e.g. "threshold", "access", "badge_colors"
  value Json
  updatedAt DateTime @updatedAt
  updatedBy String?
}
```

### Endpoint yang diperlukan

```
GET  /api/v1/settings/threshold   → ambil konfigurasi threshold (ADMIN)
PUT  /api/v1/settings/threshold   → simpan konfigurasi threshold (ADMIN)
```

**Request/Response body:**

```json
{
  "minDataPoints": 3,
  "warningEnabled": true,
  "falteringThreshold": 2,
  "badgeColors": {
    "normal": "#22c55e",
    "warning": "#eab308",
    "faltering": "#f97316",
    "giziBuruk": "#ef4444"
  }
}
```

---

## 4. Status Badge Color System

### Status: ❌ Tidak ada sama sekali

Badge color system adalah bagian dari Threshold Config (lihat bagian 3). Warna-warna status (`HIJAU`, `KUNING`, `MERAH`) saat ini digunakan di model `Measurement` sebagai enum (`statusAkhir`), namun mapping warna sepenuhnya hardcoded di frontend.

Endpoint yang diperlukan sudah tercakup di bagian 3 (`/api/v1/settings/threshold` → field `badgeColors`).

---

## 5. WHO Growth Standard Dataset

### Status: ❌ Tidak ada sama sekali

### Deskripsi frontend

Halaman ini menampilkan 6 kartu dataset WHO Growth Standard (BB/U, PB/U, TB/U, BB/PB, BB/TB, IMT/U) dengan tombol "Lihat Detail". Semua data metadata (versi, tanggal update, indikator) hardcoded di array `DATASETS` di frontend.

### Gap

- Tidak ada model untuk metadata dataset WHO
- Tidak ada cara untuk admin memperbarui versi/tanggal dataset
- Backend tidak memiliki endpoint terkait

### Schema yang diperlukan

```prisma
model WhoDataset {
  id          Int      @id @default(autoincrement())
  code        String   @unique  // e.g. "BB_U", "PB_U"
  label       String
  description String
  version     String
  lastUpdated DateTime
  ageRange    String
  isActive    Boolean  @default(true)
}
```

### Endpoint yang diperlukan

```
GET  /api/v1/settings/who-datasets          → semua dataset metadata (semua role)
PUT  /api/v1/settings/who-datasets/:id      → update metadata dataset (ADMIN only)
```

---

## 6. Informasi Sistem

### Status: ⚠️ Parsial — hanya `/health` dasar

### Yang sudah ada

Tidak ditemukan health endpoint di route registration di `app.ts`. Frontend saat ini menampilkan semua data sistem secara hardcoded (versi `v1.0.0`, build `20260210`, database `PostgreSQL 15.2`, dll.).

### Endpoint yang diperlukan

#### 6.1 System Info Detail

```
GET  /api/v1/system/info   → versi app, versi DB, status server, API latency (ADMIN)
```

**Response:**

```json
{
  "appVersion": "1.0.0",
  "buildNumber": "20260210",
  "dbVersion": "PostgreSQL 15.2",
  "lastBackup": "2025-07-12T08:00:00Z",
  "serverStatus": "online",
  "serverUptime": 99.9,
  "apiLatency": 45
}
```

#### 6.2 Backup Trigger

```
POST /api/v1/system/backup   → trigger backup database (ADMIN only)
```

#### 6.3 System Logs

```
GET  /api/v1/system/logs     → ambil log sistem terbaru (ADMIN only)
```

**Query params:** `?page=1&limit=50&level=error|warn|info`

---

## 7. Pengaturan Akses Sistem

### Status: ❌ Tidak ada sama sekali

### Deskripsi frontend

Pengaturan ini mengontrol keamanan dan akses:

- **Audit Logging**: aktifkan/nonaktifkan pencatatan aktivitas
- **Session Timeout**: durasi sesi (15/30/60/120 menit)
- **Multi-Device Login**: izinkan login dari banyak perangkat
- **Email Verification**: wajibkan verifikasi email untuk akun baru

### Gap

- Tidak ada model untuk konfigurasi akses
- Semua nilai hardcoded di frontend
- Backend tidak menerapkan logika session timeout, multi-device, atau email verification berdasarkan konfigurasi ini

### Endpoint yang diperlukan

```
GET  /api/v1/settings/access   → ambil konfigurasi akses (ADMIN)
PUT  /api/v1/settings/access   → simpan konfigurasi akses (ADMIN)
```

**Request/Response body:**

```json
{
  "auditLogging": true,
  "sessionTimeout": 30,
  "multiDeviceLogin": false,
  "emailVerification": true
}
```

> **Catatan**: Agar pengaturan ini efektif, middleware auth perlu membaca `SystemConfig` untuk menerapkan `sessionTimeout` dan `multiDeviceLogin` secara dinamis.

---

## Proposed Schema Changes — Ringkasan

Berikut semua perubahan yang diperlukan pada `prisma/schema.prisma`:

```prisma
// 1. Tambah model Kecamatan (independen dari Village)
model Kecamatan {
  id       Int       @id @default(autoincrement())
  name     String    @unique
  isActive Boolean   @default(true)
  villages Village[]
}

// 2. Ubah Village: ganti districts (String) → relasi ke Kecamatan, tambah isActive
model Village {
  id           Int        @id @default(autoincrement())
  name         String
  kecamatanId  Int
  kecamatan    Kecamatan  @relation(fields: [kecamatanId], references: [id])
  latitude     Float?
  longitude    Float?
  isActive     Boolean    @default(true)  // ← baru
  balitas      Balita[]
}

// 3. Tambah model KbmReference
model KbmReference {
  id         Int      @id @default(autoincrement())
  usiaBulan  Int      @unique
  kbmMinimal Int
  updatedAt  DateTime @updatedAt
  updatedBy  String?
}

// 4. Tambah model SystemConfig (key-value JSON untuk threshold, access, dll.)
model SystemConfig {
  id        String   @id  // e.g. "threshold", "access"
  value     Json
  updatedAt DateTime @updatedAt
  updatedBy String?
}

// 5. Tambah model WhoDataset
model WhoDataset {
  id          Int      @id @default(autoincrement())
  code        String   @unique
  label       String
  description String
  version     String
  lastUpdated DateTime
  ageRange    String
  isActive    Boolean  @default(true)
}
```

---

## Proposed New Endpoints — Ringkasan

| Method | Endpoint                              | Auth          | Keterangan                       |
| ------ | ------------------------------------- | ------------- | -------------------------------- |
| GET    | `/api/v1/kecamatan`                   | Authenticated | List semua kecamatan             |
| POST   | `/api/v1/kecamatan`                   | ADMIN         | Tambah kecamatan                 |
| PUT    | `/api/v1/kecamatan/:id`               | ADMIN         | Edit kecamatan                   |
| DELETE | `/api/v1/kecamatan/:id`               | ADMIN         | Hapus kecamatan                  |
| PATCH  | `/api/v1/kecamatan/:id/toggle-status` | ADMIN         | Toggle aktif/non-aktif           |
| GET    | `/api/v1/villages`                    | Authenticated | — sudah ada, perlu update schema |
| POST   | `/api/v1/villages`                    | ADMIN         | — perlu update validasi schema   |
| PUT    | `/api/v1/villages/:id`                | ADMIN         | — perlu update validasi schema   |
| GET    | `/api/v1/kbm`                         | Authenticated | List semua referensi KBM         |
| PUT    | `/api/v1/kbm/:id`                     | ADMIN         | Update nilai KBM per usia        |
| GET    | `/api/v1/settings/threshold`          | ADMIN         | Ambil konfigurasi threshold      |
| PUT    | `/api/v1/settings/threshold`          | ADMIN         | Simpan konfigurasi threshold     |
| GET    | `/api/v1/settings/access`             | ADMIN         | Ambil konfigurasi akses          |
| PUT    | `/api/v1/settings/access`             | ADMIN         | Simpan konfigurasi akses         |
| GET    | `/api/v1/settings/who-datasets`       | Authenticated | Ambil metadata WHO dataset       |
| PUT    | `/api/v1/settings/who-datasets/:id`   | ADMIN         | Update metadata WHO dataset      |
| GET    | `/api/v1/system/info`                 | ADMIN         | Info sistem (versi, DB, uptime)  |
| POST   | `/api/v1/system/backup`               | ADMIN         | Trigger backup database          |
| GET    | `/api/v1/system/logs`                 | ADMIN         | Ambil log sistem                 |

---

## Priority Matrix

| Fitur                                       | Prioritas | Alasan                                                           |
| ------------------------------------------- | --------- | ---------------------------------------------------------------- |
| Village: field `isActive` + update validasi | 🔴 Tinggi | Data sudah ditampilkan di frontend, tidak bisa disimpan          |
| KBM Reference (model + CRUD)                | 🔴 Tinggi | Core data operasional posyandu, saat ini 100% dummy              |
| Threshold Config (model + endpoint)         | 🔴 Tinggi | Mengontrol logika klasifikasi gizi — berdampak ke akurasi sistem |
| Kecamatan sebagai entitas independen        | 🟡 Sedang | Frontend sudah punya CRUD penuh, tapi perlu migrasi DB bertahap  |
| Pengaturan Akses Sistem                     | 🟡 Sedang | Penting untuk keamanan, tapi bisa dilakukan bertahap             |
| WHO Dataset metadata                        | 🟢 Rendah | Informational only, tidak mengubah logika kalkulasi              |
| System Info / Backup / Logs                 | 🟢 Rendah | Nice-to-have untuk monitoring operasional                        |

---

## Urutan Implementasi yang Disarankan

1. **Migrasi Village**: tambah `isActive` ke model `Village`, update `createVillageSchema` → paling cepat dan langsung bisa dipakai frontend
2. **KBM Module**: buat model `KbmReference`, seed data awal, buat modul + endpoint → prioritas tinggi karena data operasional
3. **SystemConfig + Threshold API**: model key-value JSON yang fleksibel, bisa digunakan untuk threshold DAN access config sekaligus
4. **Kecamatan model**: migrasi `districts` string ke relasi `Kecamatan` — perlu migrasi data existing, lakukan terakhir setelah data production siap
5. **WHO Dataset + System Info**: rendah prioritas, implementasi setelah fitur inti stabil
