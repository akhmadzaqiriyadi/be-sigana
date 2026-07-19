import { Router } from "express";
import {
  getAllBalitas,
  getBalitaSummary,
  getBalitaById,
  createBalita,
  updateBalita,
  deleteBalita,
  syncBalitas,
} from "./balita.controller";
import { authenticate, authorize } from "@/middlewares/auth";

/**
 * @openapi
 * /balitas:
 *   get:
 *     tags:
 *       - Balita
 *     summary: Daftar balita
 *     description: Mengambil data balita dengan filter dan paginasi. Menyertakan pengukuran terakhir.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: villageId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Daftar balita
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Balita'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 *       401:
 *         description: Belum terautentikasi
 *   post:
 *     tags:
 *       - Balita
 *     summary: Tambah balita baru
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [namaAnak, namaOrtu, tanggalLahir, jenisKelamin, villageId]
 *             properties:
 *               namaAnak: { type: string }
 *               namaOrtu: { type: string }
 *               tanggalLahir: { type: string, format: date }
 *               jenisKelamin: { type: string, enum: ['L', 'P'] }
 *               villageId: { type: integer }
 *     responses:
 *       201:
 *         description: Balita berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Balita' }
 *                 message: { type: string }
 *       400:
 *         description: Validasi gagal
 *       401:
 *         description: Belum terautentikasi
 *
 * /balitas/summary:
 *   get:
 *     tags:
 *       - Balita
 *     summary: Ringkasan statistik balita
 *     description: Mengembalikan total balita, status gizi, dan distribusi gender.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ringkasan berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     hijau: { type: integer }
 *                     kuning: { type: integer }
 *                     merah: { type: integer }
 *                     laki: { type: integer }
 *                     perempuan: { type: integer }
 *       401:
 *         description: Belum terautentikasi
 *       403:
 *         description: Akses ditolak
 *
 * /balitas/sync:
 *   post:
 *     tags:
 *       - Balita
 *     summary: Sinkronisasi data balita offline
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               balitas:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     localId: { type: string }
 *                     namaAnak: { type: string }
 *                     namaOrtu: { type: string }
 *                     tanggalLahir: { type: string, format: date }
 *                     jenisKelamin: { type: string, enum: ['L', 'P'] }
 *                     villageId: { type: integer }
 *     responses:
 *       200:
 *         description: Sinkronisasi berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       localId: { type: string }
 *                       serverId: { type: string }
 *                       status: { type: string }
 *                       error: { type: string }
 *       401:
 *         description: Belum terautentikasi
 *       403:
 *         description: Akses ditolak
 *
 * /balitas/{id}:
 *   get:
 *     tags:
 *       - Balita
 *     summary: Detail balita
 *     description: Mengambil data lengkap satu balita.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Data balita
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Balita' }
 *       401:
 *         description: Belum terautentikasi
 *       404:
 *         description: Balita tidak ditemukan
 *   put:
 *     tags:
 *       - Balita
 *     summary: Update data balita
 *     description: Memperbarui data balita secara lengkap. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namaAnak: { type: string }
 *               namaOrtu: { type: string }
 *               tanggalLahir: { type: string, format: date }
 *               jenisKelamin: { type: string, enum: ['L', 'P'] }
 *               villageId: { type: integer }
 *     responses:
 *       200:
 *         description: Data berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Balita' }
 *       400:
 *         description: Validasi gagal
 *       401:
 *         description: Belum terautentikasi
 *       403:
 *         description: Akses ditolak
 *       404:
 *         description: Balita tidak ditemukan
 *   patch:
 *     tags:
 *       - Balita
 *     summary: Update sebagian data balita
 *     description: Memperbarui data balita secara parsial. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namaAnak: { type: string }
 *               namaOrtu: { type: string }
 *               tanggalLahir: { type: string, format: date }
 *               jenisKelamin: { type: string, enum: ['L', 'P'] }
 *               villageId: { type: integer }
 *     responses:
 *       200:
 *         description: Data berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Balita' }
 *       400:
 *         description: Validasi gagal
 *       401:
 *         description: Belum terautentikasi
 *       403:
 *         description: Akses ditolak
 *       404:
 *         description: Balita tidak ditemukan
 *   delete:
 *     tags:
 *       - Balita
 *     summary: Hapus data balita
 *     description: Menghapus data balita dan riwayat pengukuran. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Data berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *       401:
 *         description: Belum terautentikasi
 *       403:
 *         description: Akses ditolak
 *       404:
 *         description: Balita tidak ditemukan
 */
import { validate } from "@/middlewares/validate";
import {
  createBalitaSchema,
  syncBalitaSchema,
} from "@/validations/master.validation";

const router = Router();

router.use(authenticate);

// Relawan can read and create
router.get("/", authorize("ADMIN", "RELAWAN"), getAllBalitas);
router.get(
  "/summary",
  authorize("ADMIN", "STAKEHOLDER", "RELAWAN"),
  getBalitaSummary
);
router.post(
  "/sync",
  authorize("RELAWAN", "ADMIN"),
  validate(syncBalitaSchema),
  syncBalitas
);

router.get("/:id", authorize("ADMIN", "RELAWAN"), getBalitaById);
router.post(
  "/",
  authorize("RELAWAN", "ADMIN"),
  validate(createBalitaSchema),
  createBalita
);

// Admin only for update and delete
router.put("/:id", authorize("ADMIN"), updateBalita);
router.patch("/:id", authorize("ADMIN"), updateBalita);
router.delete("/:id", authorize("ADMIN"), deleteBalita);

export default router;
