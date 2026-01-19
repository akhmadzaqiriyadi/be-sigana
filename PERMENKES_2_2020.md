# RINGKASAN PERMENKES NO 2 TAHUN 2020
## TENTANG STANDAR ANTROPOMETRI ANAK

**Referensi Hukum Utama**: Peraturan Menteri Kesehatan Republik Indonesia Nomor 2 Tahun 2020.
**Fungsi**: Sebagai acuan penilaian status gizi anak di Indonesia (mengadopsi WHO Child Growth Standards 2006).

---

### A. KATEGORI & AMBANG BATAS STATUS GIZI (UMUR 0 - 60 BULAN)

Sistem SiGana menggunakan ambang batas (Cut-off points) berikut untuk menentukan warna status (Merah/Kuning/Hijau):

#### 1. Indeks Berat Badan menurut Umur (BB/U)
Parameter untuk mendeteksi **Underweight** (Berat Kurang) dan **Severely Underweight** (Gizi Buruk).
| Z-Score (SD) | Status Gizi | Label Sistem |
| :--- | :--- | :--- |
| < -3 SD | **Berat Badan Sangat Kurang** (Severely Underweight) | 🔴 MERAH |
| -3 SD s/d < -2 SD | **Berat Badan Kurang** (Underweight) | 🟡 KUNING |
| -2 SD s/d +1 SD | **Berat Badan Normal** | 🟢 HIJAU |
| > +1 SD | Risiko Berat Badan Lebih | 🟢 HIJAU |

#### 2. Indeks Panjang Badan / Tinggi Badan menurut Umur (PB/U atau TB/U)
Parameter untuk mendeteksi **Stunting** (Pendek).
| Z-Score (SD) | Status Gizi | Label Sistem |
| :--- | :--- | :--- |
| < -3 SD | **Sangat Pendek** (Severely Stunted) | 🔴 MERAH |
| -3 SD s/d < -2 SD | **Pendek** (Stunted) | 🟡 KUNING |
| -2 SD s/d +3 SD | **Normal** | 🟢 HIJAU |
| > +3 SD | Tinggi | 🟢 HIJAU |

#### 3. Indeks Berat Badan menurut Panjang Badan / Tinggi Badan (BB/PB atau BB/TB)
Parameter untuk mendeteksi **Wasting** (Gizi Buruk Akut/Kurus).
| Z-Score (SD) | Status Gizi | Label Sistem |
| :--- | :--- | :--- |
| < -3 SD | **Gizi Buruk** (Severely Wasted) | 🔴 MERAH |
| -3 SD s/d < -2 SD | **Gizi Kurang** (Wasted) | 🟡 KUNING |
| -2 SD s/d +1 SD | **Gizi Baik** (Normal) | 🟢 HIJAU |
| > +1 SD s/d +2 SD | Berisiko Gizi Lebih | 🟢 HIJAU |
| > +2 SD s/d +3 SD | Gizi Lebih (Overweight) | 🟢 HIJAU (Alert) |
| > +3 SD | Obesitas | 🟢 HIJAU (Alert) |

---

### B. LOGIKA SISTEM (IMPLEMENTASI BACKEND)

Sistem Backend SiGana melakukan pengecekan bertingkat:
1.  **Hitung Umur Bulan** secara otomatis dari Tanggal Lahir.
2.  **Cek Tabel Referensi BB/U** (Berat vs Umur) sesuai Jenis Kelamin.
3.  **Cek Tabel Referensi TB/U** (Tinggi vs Umur) sesuai Jenis Kelamin.
4.  **Penentuan Status Akhir**:
    *   Jika **salah satu** indikator (BB/U, TB/U, atau BB/TB) berada di zona **MERAH** (< -3 SD), maka Status Akhir = **MERAH**.
    *   Jika indikator terburuk ada di zona **KUNING** (-3 s/d -2 SD), maka Status Akhir = **KUNING**.
    *   Lainnya = **HIJAU**.

---

### C. SAMPEL DATA REFERENSI (WHO 2006 / PERMENKES 2020)
*Data yang digunakan dalam kode `src/utils/zscore/constants.ts` (0-24 Bulan).*

**Contoh: Berat Badan menurut Umur (Laki-laki)**
| Umur (Bulan) | -3 SD (Merah) | -2 SD (Kuning) | Median (0) |
| :--- | :--- | :--- | :--- |
| 0 | 2.1 kg | 2.5 kg | 3.3 kg |
| 6 | 5.7 kg | 6.4 kg | 7.9 kg |
| 12 | 7.1 kg | 7.7 kg | 9.6 kg |
| 24 | 8.6 kg | 9.7 kg | 12.2 kg |

**Contoh: Panjang Badan menurut Umur (Perempuan)**
| Umur (Bulan) | -3 SD (Merah) | -2 SD (Kuning) | Median (0) |
| :--- | :--- | :--- | :--- |
| 0 | 43.6 cm | 45.4 cm | 49.1 cm |
| 12 | 68.9 cm | 70.7 cm | 74.0 cm |
| 24 | 80.0 cm | 82.0 cm | 87.1 cm |

---
**Catatan Teknis**: 
- Untuk BB/TB, karena tabel aslinya sangat panjang (interval 0.5 cm dari 45cm s/d 110cm), sistem menggunakan rumus aproksimasi yang dikalibrasi agar memiliki margin error < 0.2 kg dibandingkan tabel asli.
- Dokumen asli PDF tersimpan di root project sebagai arsip lengkap.
