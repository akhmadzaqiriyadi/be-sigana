import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import { validate } from "@/middlewares/validate";
import { getKbmReferences, updateKbmReference } from "./kbm.controller";
import { updateKbmReferenceSchema } from "@/validations/master.validation";

/**
 * @openapi
 * /kbm:
 *   get:
 *     tags:
 *       - KBM
 *     summary: Daftar referensi KBM
 *     description: Mengambil seluruh referensi KBM (usia 0–60 bulan). Tersedia untuk semua pengguna yang sudah terautentikasi.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar referensi KBM berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Referensi KBM berhasil diambil" }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, example: 1 }
 *                       usiaBulan: { type: integer, example: 0 }
 *                       kbmMinimal: { type: integer, example: 20 }
 *                       updatedAt: { type: string, format: date-time }
 *                       updatedBy: { type: string, nullable: true, example: "admin@example.com" }
 *       401:
 *         description: Belum terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Belum terautentikasi'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Terjadi kesalahan pada server'
 *
 * /kbm/{id}:
 *   put:
 *     tags:
 *       - KBM
 *     summary: Perbarui referensi KBM
 *     description: Memperbarui nilai KBM minimal pada referensi berdasarkan ID. Hanya dapat dilakukan oleh Admin.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *         description: ID referensi KBM
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [kbmMinimal]
 *             properties:
 *               kbmMinimal:
 *                 type: integer
 *                 minimum: 0
 *                 example: 25
 *                 description: Nilai minimal KBM yang baru
 *     responses:
 *       200:
 *         description: Referensi KBM berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Referensi KBM berhasil diperbarui" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer, example: 1 }
 *                     usiaBulan: { type: integer, example: 0 }
 *                     kbmMinimal: { type: integer, example: 25 }
 *                     updatedAt: { type: string, format: date-time }
 *                     updatedBy: { type: string, nullable: true, example: "admin@example.com" }
 *       400:
 *         description: Validasi gagal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Nilai KBM minimal tidak valid'
 *       401:
 *         description: Belum terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Belum terautentikasi'
 *       403:
 *         description: Akses ditolak (bukan Admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Akses ditolak'
 *       404:
 *         description: Referensi tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Referensi KBM tidak ditemukan'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Terjadi kesalahan pada server'
 */
const router = Router();

router.use(authenticate);

router.get("/", getKbmReferences);
router.put(
  "/:id",
  authorize("ADMIN"),
  validate(updateKbmReferenceSchema),
  updateKbmReference
);

export default router;
