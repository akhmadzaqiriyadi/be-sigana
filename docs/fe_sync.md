# FE ↔ BE Sync — Implementation Walkthrough

> Tanggal: 3 Maret 2026  
> Referensi: Gap analysis `fe-sigana ↔ be-sigana`

---

## Bagian 1 — Perubahan yang Sudah Dilakukan di Backend

### ✅ B1 — Endpoint `PATCH /api/v1/users/:id/password` (Baru)

**File yang diubah:**

| File                                   | Perubahan                          |
| -------------------------------------- | ---------------------------------- |
| `src/validations/master.validation.ts` | Tambah `changePasswordSchema`      |
| `src/modules/user/user.service.ts`     | Tambah method `changePassword()`   |
| `src/modules/user/user.controller.ts`  | Tambah handler `changePassword`    |
| `src/modules/user/user.routes.ts`      | Tambah route `PATCH /:id/password` |

**Request body:**

```json
{ "currentPassword": "string (min 1)", "newPassword": "string (min 8)" }
```

**Aturan otorisasi:** Owner (`req.user.userId === params.id`) atau Admin. Jika `currentPassword` salah → `401`. User tidak ditemukan → `404`.

**Response sukses (200):**

```json
{ "success": true, "message": "Password berhasil diubah" }
```

---

### ✅ C1 — `PATCH /api/v1/balitas/:id` (Alias untuk PUT)

**File:** `src/modules/balita/balita.routes.ts`

Ditambahkan alias `PATCH /:id` yang memanggil handler `updateBalita` yang sama. Kedua method tersedia, keduanya memerlukan role `ADMIN`.

---

### ✅ E3 — `GET /api/v1/poskos` Menyertakan `_count.measurements`

**File:** `src/modules/posko/posko.service.ts`

Response list posko kini menyertakan jumlah pengukuran yang dihitung via relasi `balita → measurement`.

```json
{
  "_count": { "balitas": 12, "measurements": 47 },
  "village": { "id": 2, "name": "Desa Sukamaju", "districts": "Kec. Cibeber" }
}
```

> `village.name` sudah tersedia di response — FE tinggal render `posko.village.name` menggantikan `Desa ID: {posko.villageId}`.

---

### ✅ Posko Removal — Penghapusan Entitas Posko (Full Backend)

Posko telah dihapus sepenuhnya dari backend. Berikut daftar lengkap perubahan:

| File                                                                 | Perubahan                                                                                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                               | Hapus model `Posko`; hapus `poskoId`/`posko` dari `Balita`; hapus `poskos` dari `Village`; tambah `latitude?`/`longitude?` ke `Village` |
| `prisma/migrations/20260303000000_remove_posko_entity/migration.sql` | Migration SQL: salin koordinat ke `villages`, drop FK, drop kolom `poskoId`, drop tabel `poskos`                                        |
| `src/modules/posko/`                                                 | **Dihapus seluruh folder** (controller, routes, service, test)                                                                          |
| `src/app.ts`                                                         | Hapus import `poskoRoutes` dan `app.use('/api/v1/poskos')`                                                                              |
| `src/modules/balita/balita.service.ts`                               | Hapus `poskoId` dari interface, filter, include, create, update, sync                                                                   |
| `src/modules/balita/balita.controller.ts`                            | Hapus `poskoId` dari semua handler                                                                                                      |
| `src/modules/balita/balita.test.ts`                                  | Hapus mock `prisma.posko`, hapus `poskoId` dari fixture                                                                                 |
| `src/modules/balita/balita.routes.ts`                                | Hapus `poskoId` dan `posko` dari Swagger JSDoc                                                                                          |
| `src/modules/measurement/measurement.service.ts`                     | Hapus `posko` dari semua `include`; `poskoName` sekarang dari `village.name`                                                            |
| `src/modules/village/village.service.ts`                             | Hapus `poskos: true` dari `_count` dan `findById`                                                                                       |
| `src/validations/master.validation.ts`                               | Hapus `createPoskoSchema`, `poskoId` dari `createBalitaSchema` dan `syncBalitaSchema`                                                   |
| `src/config/swagger.ts`                                              | Hapus `poskoId` dari skema `Balita`; kosongkan skema `Posko`                                                                            |
| `src/scripts/verify-sync.ts`                                         | Hapus `poskoId: null` dari payload sync                                                                                                 |

**Status database:** Sudah sinkron. Tabel `poskos` tidak pernah ada di DB aktif. Kolom `latitude`/`longitude` sudah ada di tabel `villages`. Prisma client sudah di-regenerate.

**Hasil test:** 40 pass / 4 fail — semua kegagalan adalah pre-existing (3x ZScoreCalculator, 1x BalitaService findAll mock). Zero regresi baru.

---

## Bagian 2 — Yang Perlu Dilakukan di Frontend (`fe-sigana`)

### 🔴 A3 — Dropdown Desa dari API, Hapus Posko (Critical)

**File:** `src/features/relawan/components/input-data-step1.tsx`

**Masalah:** Dropdown Desa masih hardcoded. Dropdown Posko harus dihapus sepenuhnya.

**Yang harus dilakukan:**

1. Ganti `SelectItem` statis Desa dengan data dari `useVillages()`:

```tsx
const { data: villagesData } = useVillages();
// ...
{
  villagesData?.data.map((v) => (
    <SelectItem key={v.id} value={String(v.id)}>
      {v.name}
    </SelectItem>
  ));
}
```

2. **Hapus seluruh blok dropdown Posko** (label + Select + handler `handlePoskoChange`).

3. **Ubah tipe `ChildIdentity`:**

```ts
// Hapus:
desa: string;
posko: string;
poskoId: string | null;

// Ganti dengan:
villageId: number;
```

---

### 🔴 A2 — Wire Submit Form Input Data ke API (Critical)

**File:** `src/app/relawan/(app)/input/create/page.tsx`

**Masalah:** `handleNext` di step 5 masih dummy ID dan `console.log`.

**Yang harus dilakukan:**

1. Jika balita baru, kirim `POST /api/v1/balitas`:

```ts
const balita = await createBalita({
  namaAnak: formData.step1.namaAnak,
  namaOrtu: formData.step1.namaOrtu,
  tanggalLahir: formData.step1.tanggalLahir,
  jenisKelamin: formData.step1.jenisKelamin,
  villageId: formData.step1.villageId, // number, bukan string
});
balitaId = balita.data.id;
```

> ⚠️ Tidak ada `poskoId` — field ini sudah dihapus dari backend.

2. Kirim `POST /api/v1/measurements`:

```ts
const measurement = await createMeasurement({
  balitaId,
  beratBadan: formData.step2.beratBadan,
  tinggiBadan: formData.step2.tinggiBadan,
  lingkarKepala: formData.step2.lingkarKepala,
  lila: formData.step2.lila,
  posisiUkur: formData.step2.posisiUkur, // 'TERLENTANG' | 'BERDIRI'
  sanitationData: formData.step3,
  medicalHistoryData: formData.step4,
  notes: formData.step5?.notes,
});
```

3. Redirect ke ID nyata:

```ts
router.push(`/relawan/result/${measurement.data.id}`);
```

4. Tangani error dengan toast/alert.

---

### 🔴 A1 — Halaman Result dari Data Nyata (Critical)

**File:** `src/app/relawan/(app)/result/[id]/page.tsx`

**Masalah:** Semua data masih hardcoded.

**Yang harus dilakukan:**

1. Ambil ID dari URL: `const { id } = useParams();`
2. Fetch data: `const { data, isLoading } = useMeasurement(id);`
3. Mapping ke komponen (gunakan `share/[id]/page.tsx` sebagai referensi — sudah terintegrasi dengan benar).
4. Wire `handleShare`: `router.push(\`/share/${id}\`)`

---

### 🟠 D1 — Fix Type `topRiskVillages`

**File:** `src/features/measurements/types/index.ts`

Backend sudah mengembalikan field ini — tambahkan ke tipe:

```ts
topRiskVillages?: {
  id: number;
  nama: string;
  districts: string;
  totalBalita: number;
  riskPercentage: number;
  HIJAU: number;   // ← tambahkan
  KUNING: number;  // ← tambahkan
  MERAH: number;   // ← tambahkan
}[];
```

---

### 🟡 D3 — Konsistensi `status` → `statusAkhir`

**File:** `src/features/measurements/types/index.ts`, `src/app/app/(shared)/measurements/page.tsx`

Backend hanya mengembalikan `statusAkhir`. Field `status` tidak ada di response.

1. Hapus field `status` dari tipe `Measurement`.
2. Ganti semua `m.status` di `measurements/page.tsx` → `m.statusAkhir`.
3. Audit komponen lain yang mungkin menggunakan `m.status`.

---

### 🟡 E3 — Render Statistik di Halaman Posko

**File:** `src/app/app/(admin)/poskos/page.tsx`

Backend sekarang mengembalikan `_count.balitas`, `_count.measurements`, dan `village.name`. Ganti placeholder `-`:

```tsx
<TableCell>{posko._count.balitas}</TableCell>
<TableCell>{posko._count.measurements}</TableCell>
<TableCell>{posko.village.name}</TableCell>  {/* bukan "Desa ID: X" */}
```

---

### 🟡 F1 — Server-side Search di Halaman Measurements

**File:** `src/app/app/(shared)/measurements/page.tsx`

Ganti fetch semua data + filter client-side:

```ts
// Sebelum (tidak skalabel):
const measurementsQuery = useMeasurements();
const filteredData = measurementsQuery.data?.data.filter((m) =>
  m.balita?.namaAnak.toLowerCase().includes(search.toLowerCase())
);

// Sesudah:
const measurementsQuery = useMeasurements({
  q: debouncedSearch,
  page,
  limit: 10,
});
// Hapus .filter() client-side, tambah komponen pagination
```

---

### 🔴 Posko Removal — Bersihkan Frontend dari Entitas Posko

Ini wajib dilakukan agar FE tidak crash setelah BE menghapus Posko.

#### F-P1 — Hapus Fitur Posko

```
src/features/poskos/         ← HAPUS SELURUH FOLDER
src/app/app/(admin)/poskos/  ← HAPUS HALAMAN
```

#### F-P2 — Tipe Balita (`src/features/balitas/types/index.ts`)

```ts
// Hapus dari Balita type:
poskoId?: string
posko?: { id: string; name: string }

// Hapus dari CreateBalitaDTO:
poskoId?: string
```

#### F-P3 — Form Step 1 Relawan (`src/features/relawan/components/input-data-step1.tsx`)

- Hapus `import { usePoskos }` dan panggilan `usePoskos()`
- Hapus handler `handlePoskoChange()`
- Hapus seluruh blok JSX dropdown "Posko"
- Hapus field `poskoId`/`posko` dari `onUpdate()` di `handleVillageChange()`

#### F-P4 — Form Step 5 Summary Relawan (`src/features/relawan/components/input-data-step5.tsx`)

```tsx
// Hapus baris:
<SummaryRow label="Posko" value={step1.posko} />
```

#### F-P5 — Form Create Balita Admin (`src/features/balitas/components/create-balita.tsx`)

- Hapus `usePoskos()` hook
- Hapus `poskoId` dari Zod schema
- Hapus `poskoId` dari `mutateAsync()` payload
- Hapus seluruh blok JSX `<FormField name="poskoId">` (dropdown Posko Opsional)

#### F-P6 — Wizard Create Balita

- `wizard-step1.tsx` → hapus field `posko` dari form
- `wizard-step5.tsx` → hapus `data.step1.posko` dari summary

#### F-P7 — Komponen Display (ganti `balita.posko?.name` → `balita.village?.name`)

| File                          | Perubahan                       |
| ----------------------------- | ------------------------------- |
| `balita-detail-sheet.tsx`     | `balita.village?.name \|\| '-'` |
| `balita-profile-overview.tsx` | `balita.village?.name \|\| '-'` |
| `balita-list-item.tsx`        | `balita.village?.name \|\| '-'` |
| `share/[id]/page.tsx`         | `balita.village?.name \|\| '-'` |

#### F-P8 — PDF Export (`src/features/relawan/components/pdf/measurement-pdf.tsx`)

```ts
// Ganti:
poskoName?: string;
poskoName = 'Posko Sigana',

// Dengan:
locationName?: string;
locationName = 'SiGana',
```

#### F-P9 — Offline DB Types (`src/lib/db.ts`)

```ts
// Hapus:
poskoId?: string;
posko?: { id: string; name: string };
```

#### F-P10 — `isNextDisabled` di create/page.tsx

```ts
// Hapus !poskoId dari kondisi validasi step 1
const { namaAnak, namaOrtu, jenisKelamin, tanggalLahir, villageId } = ...
// Tidak perlu cek poskoId lagi
```

---

### 🟢 E1 — Village Management (CRUD Admin)

**File:** `src/features/villages/api/index.ts`

Tambahkan fungsi yang belum ada:

```ts
export const createVillage = (data: { name: string; districts: string }) =>
  api.post("/api/v1/villages", data);

export const updateVillage = ({
  id,
  data,
}: {
  id: number;
  data: Partial<Village>;
}) => api.put(`/api/v1/villages/${id}`, data);

export const deleteVillage = (id: number) =>
  api.delete(`/api/v1/villages/${id}`);
```

Buat halaman admin `/app/villages/page.tsx` dengan tabel + modal create/edit/delete.

---

### 🟢 F2 — `syncPull` Downstream

**File:** `src/lib/sync/`

Backend sudah menyediakan `GET /api/v1/measurements/sync-pull?lastSync={ISO_DATE}`. Implementasikan di frontend: saat koneksi kembali online, tarik delta dari server sejak timestamp sync terakhir.

---

## Ringkasan Checklist Frontend

### Posko Removal (Wajib — BE sudah hapus, FE akan crash jika tidak diikuti)

| Status | Item                                                               | File                                                  |
| ------ | ------------------------------------------------------------------ | ----------------------------------------------------- |
| ⬜     | F-P1: Hapus folder `features/poskos/` dan halaman admin posko      | `src/features/poskos/`, `src/app/app/(admin)/poskos/` |
| ⬜     | F-P2: Hapus `poskoId`/`posko` dari Balita types                    | `features/balitas/types/index.ts`                     |
| ⬜     | F-P3: Bersihkan form step 1 relawan                                | `input-data-step1.tsx`                                |
| ⬜     | F-P4: Hapus baris Posko dari step 5 summary                        | `input-data-step5.tsx`                                |
| ⬜     | F-P5: Bersihkan create-balita admin form                           | `create-balita.tsx`                                   |
| ⬜     | F-P6: Bersihkan wizard step 1 & 5                                  | `wizard-step1.tsx`, `wizard-step5.tsx`                |
| ⬜     | F-P7: Ganti `balita.posko?.name` → `balita.village?.name` (5 file) | Lihat tabel di atas                                   |
| ⬜     | F-P8: Update PDF export                                            | `measurement-pdf.tsx`                                 |
| ⬜     | F-P9: Update offline DB types                                      | `src/lib/db.ts`                                       |
| ⬜     | F-P10: Hapus `poskoId` dari validasi form create                   | `create/page.tsx`                                     |

### Integrasi API (Prioritas Fitur)

| Status | Priority | Item                                                               | File                                   |
| ------ | -------- | ------------------------------------------------------------------ | -------------------------------------- |
| ⬜     | 🔴       | A3: Dropdown Desa dari API (tidak ada lagi Posko)                  | `input-data-step1.tsx`                 |
| ⬜     | 🔴       | A2: Submit form ke real API                                        | `input/create/page.tsx`                |
| ⬜     | 🔴       | A1: Result page dari data nyata                                    | `result/[id]/page.tsx`                 |
| ✅     | 🟠       | B1: `changePassword` endpoint (BE selesai, FE call sudah benar)    | `users/api/index.ts`                   |
| ⬜     | 🟠       | D1: Fix type `topRiskVillages`                                     | `measurements/types/index.ts`          |
| ⬜     | 🟡       | D3: `status` → `statusAkhir`                                       | `measurements/types/index.ts`          |
| ⬜     | 🟡       | E3: Render statistik posko (`_count.measurements`, `village.name`) | `poskos/page.tsx`                      |
| ⬜     | 🟡       | F1: Server-side search measurements                                | `measurements/page.tsx`                |
| ⬜     | 🟢       | E1: Village CRUD admin UI                                          | `villages/api/index.ts` + halaman baru |
| ⬜     | 🟢       | F2: syncPull downstream                                            | `src/lib/sync/`                        |
