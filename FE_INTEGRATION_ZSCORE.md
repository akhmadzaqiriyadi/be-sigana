# Panduan Integrasi Frontend: Grafik Pertumbuhan (Z-Score)

## Overview

Backend telah diperbarui untuk mendukung perhitungan dan status gizi untuk 6 indikator (sebelumnya hanya 3), sesuai dengan standar WHO dan Permenkes No 2 Tahun 2020. Endpoint pengukuran sekarang mengembalikan data Z-Score dan status untuk:

1.  **BB/U** (Berat Badan menurut Umur)
2.  **TB/U** (Panjang/Tinggi Badan menurut Umur)
3.  **BB/TB** (Berat Badan menurut Panjang/Tinggi Badan)
4.  **LK/U** (Lingkar Kepala menurut Umur)
5.  **LiLA/U** (Lingkar Lengan Atas menurut Umur)
6.  **IMT/U** (Indeks Massa Tubuh menurut Umur)

Respons API telah diperkaya dengan field baru untuk mendukung visualisasi 6 grafik tersebut.

## Perubahan Response Data

### Endpoint

- `GET /measurements`
- `GET /measurements/:id`
- `GET /public/measurements/:id`

### Struktur Baru dari `Measurement`

Setiap objek pengukuran kini memiliki field status tambahan:

```json
{
  "id": "...",
  "beratBadan": 10.5,
  "tinggiBadan": 80,
  "lingkarKepala": 45, // Baru
  "lila": 14,          // Baru

  // Status Gizi (Label String)
  "bb_u_status": "Berat Badan Normal",
  "tb_u_status": "Normal",
  "bb_tb_status": "Gizi Baik",
  "lk_u_status": "Normal",        // Baru
  "lila_u_status": "Gizi Baik",   // Baru
  "imt_u_status": "Gizi Baik",    // Baru

  "statusAkhir": "HIJAU", // HIJAU / KUNING / MERAH
  ...
}
```

### Catatan Penting untuk Frontend

1.  **Grafik 1-3 (BB/U, TB/U, BB/TB)**: Gunakan field `beratBadan`, `tinggiBadan` dan status `bb_u_status`, `tb_u_status`, `bb_tb_status` seperti sebelumnya.
2.  **Grafik 4 (LK/U)**:
    - Gunakan nilai `lingkarKepala` (cm).
    - Status: `lk_u_status`.
    - Plot terhadap Umur (bulan).
3.  **Grafik 5 (LiLA/U)**:
    - Gunakan nilai `lila` (cm).
    - Status: `lila_u_status`.
    - Plot terhadap Umur (bulan).
4.  **Grafik 6 (IMT/U)**:
    - Hitung nilai IMT di frontend atau gunakan kalkulasi backend jika tersedia (saat ini backend menghitung statusnya).
    - Rumus IMT: `Berat (kg) / (Tinggi (m) * Tinggi (m))`.
    - Status: `imt_u_status`.
    - Plot terhadap Umur (bulan).

## Status Label & Warna (Saran UI)

| Indikator  | Label (Contoh)           | Warna Disarankan |
| :--------- | :----------------------- | :--------------- |
| **BB/U**   | Kurang, Sangat Kurang    | Merah/Kuning     |
| **TB/U**   | Pendek, Sangat Pendek    | Merah/Kuning     |
| **BB/TB**  | Gizi Buruk, Gizi Kurang  | Merah/Kuning     |
| **LK/U**   | Mikrocepali, Makrocepali | Merah            |
| **LiLA/U** | Gizi Buruk (< 11.5cm)    | Merah            |
| **IMT/U**  | Sangat Kurus, Obesitas   | Merah            |

Semua status "Normal" atau "Gizi Baik" dapat ditampilkan dengan warna **Hijau**.

## TypeScript Interface (Contoh)

Jika Anda menggunakan TypeScript di Frontend, update interface `Measurement` Anda:

```typescript
export interface Measurement {
  id: string;
  beratBadan: number;
  tinggiBadan: number;
  lingkarKepala: number;
  lila: number;

  bb_u_status: string;
  tb_u_status: string;
  bb_tb_status: string;
  lk_u_status?: string | null; // Field baru mungkin null untuk data lama
  lila_u_status?: string | null; // Field baru mungkin null untuk data lama
  imt_u_status?: string | null; // Field baru mungkin null untuk data lama

  statusAkhir: "HIJAU" | "KUNING" | "MERAH";
  // ... field lainnya
}
```
