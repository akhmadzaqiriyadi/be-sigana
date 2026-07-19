import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import { validate } from "@/middlewares/validate";
import {
  getAccessConfig,
  getBootstrapStatus,
  getThresholdConfig,
  getWhoDatasets,
  resetThresholdConfig,
  updateAccessConfig,
  updateThresholdConfig,
  updateWhoDataset,
} from "./settings.controller";
import {
  updateAccessConfigSchema,
  updateThresholdConfigSchema,
  updateWhoDatasetSchema,
} from "@/validations/master.validation";

/**
 * @openapi
 * /settings/threshold:
 *   get:
 *     tags: [Setting]
 *     summary: Ambil konfigurasi threshold
 *     description: Mengembalikan seluruh konfigurasi threshold saat ini. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil konfigurasi threshold
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: "#/components/schemas/ThresholdConfig"
 *       401:
 *         description: Tidak terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *             example:
 *               success: false
 *               message: Belum terautentikasi
 *       403:
 *         description: Tidak memiliki akses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *             example:
 *               success: false
 *               message: Hanya admin yang dapat mengakses
 *
 * @openapi
 * /settings/threshold:
 *   put:
 *     tags: [Setting]
 *     summary: Perbarui konfigurasi threshold
 *     description: Memperbarui nilai threshold seperti minDataPoints, warningEnabled, falteringThreshold, dan badgeColors. Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - minDataPoints
 *               - warningEnabled
 *               - falteringThreshold
 *               - badgeColors
 *             properties:
 *               minDataPoints:
 *                 type: integer
 *                 minimum: 1
 *                 example: 3
 *               warningEnabled:
 *                 type: boolean
 *                 example: true
 *               falteringThreshold:
 *                 type: integer
 *                 minimum: 1
 *                 example: 5
 *               badgeColors:
 *                 type: object
 *                 properties:
 *                   normal:
 *                     type: string
 *                     example: "#22C55E"
 *                   warning:
 *                     type: string
 *                     example: "#EAB308"
 *                   faltering:
 *                     type: string
 *                     example: "#F97316"
 *                   giziBuruk:
 *                     type: string
 *                     example: "#EF4444"
 *     responses:
 *       200:
 *         description: Konfigurasi threshold berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: "#/components/schemas/ThresholdConfig"
 *       400:
 *         description: Validasi gagal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *             example:
 *               success: false
 *               message: Data yang diberikan tidak valid
 *       401:
 *         description: Tidak terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: Tidak memiliki akses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *
 * @openapi
 * /settings/threshold/reset:
 *   post:
 *     tags: [Setting]
 *     summary: Reset konfigurasi threshold
 *     description: Mereset nilai threshold tertentu berdasarkan key ke nilai default. Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *             properties:
 *               key:
 *                 type: string
 *                 description: Nama key threshold yang akan direset
 *                 example: "falteringThreshold"
 *     responses:
 *       200:
 *         description: Threshold berhasil direset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: "#/components/schemas/ThresholdConfig"
 *       400:
 *         description: Key tidak valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       401:
 *         description: Tidak terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: Tidak memiliki akses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *
 * @openapi
 * /settings/access:
 *   get:
 *     tags: [Setting]
 *     summary: Ambil konfigurasi akses
 *     description: Mengembalikan seluruh konfigurasi akses sistem (audit logging, session timeout, dll). Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil konfigurasi akses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: "#/components/schemas/AccessConfig"
 *       401:
 *         description: Tidak terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: Tidak memiliki akses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *
 * @openapi
 * /settings/access:
 *   put:
 *     tags: [Setting]
 *     summary: Perbarui konfigurasi akses
 *     description: Memperbarui konfigurasi akses seperti auditLogging, sessionTimeout, multiDeviceLogin, dan emailVerification. Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - auditLogging
 *               - sessionTimeout
 *               - multiDeviceLogin
 *               - emailVerification
 *             properties:
 *               auditLogging:
 *                 type: boolean
 *                 example: true
 *               sessionTimeout:
 *                 type: integer
 *                 enum: [15, 30, 60, 120]
 *                 example: 30
 *               multiDeviceLogin:
 *                 type: boolean
 *                 example: true
 *               emailVerification:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Konfigurasi akses berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: "#/components/schemas/AccessConfig"
 *       400:
 *         description: Validasi gagal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       401:
 *         description: Tidak terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: Tidak memiliki akses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *
 * @openapi
 * /settings/who-datasets:
 *   get:
 *     tags: [Setting]
 *     summary: Ambil daftar dataset WHO
 *     description: Mengembalikan seluruh dataset WHO yang tersimpan (pertumbuhan balita, dll). Admin atau Stakeholder.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil daftar dataset WHO
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/WhoDataset"
 *       401:
 *         description: Tidak terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: Tidak memiliki akses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *
 * @openapi
 * /settings/who-datasets/{id}:
 *   put:
 *     tags: [Setting]
 *     summary: Perbarui dataset WHO
 *     description: Memperbarui dataset WHO berdasarkan ID. Hanya mengubah field yang dikirim. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dataset WHO
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 example: "who_2006_boy"
 *               label:
 *                 type: string
 *                 example: "WHO Child Growth Standards 2006 — Boys"
 *               description:
 *                 type: string
 *                 example: "Standar pertumbuhan anak WHO 2006 untuk anak laki-laki"
 *               version:
 *                 type: string
 *                 example: "1.2"
 *               lastUpdated:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-06-01T00:00:00Z"
 *               ageRange:
 *                 type: string
 *                 example: "0-60 bulan"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Dataset WHO berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: "#/components/schemas/WhoDataset"
 *       400:
 *         description: Validasi gagal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       401:
 *         description: Tidak terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: Tidak memiliki akses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: Dataset tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *
 * @openapi
 * /settings/bootstrap-status:
 *   get:
 *     tags: [Setting]
 *     summary: Cek status bootstrap sistem
 *     description: Mengecek apakah data awal (seed/bootstrap) sudah dimuat ke sistem. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status bootstrap berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     isBootstrapped:
 *                       type: boolean
 *                       example: true
 *                     bootstrappedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: "2025-06-01T00:00:00Z"
 *       401:
 *         description: Tidak terautentikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: Tidak memiliki akses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
const router = Router();

router.use(authenticate);

router.get("/threshold", authorize("ADMIN"), getThresholdConfig);
router.put(
  "/threshold",
  authorize("ADMIN"),
  validate(updateThresholdConfigSchema),
  updateThresholdConfig
);
router.post("/threshold/reset", authorize("ADMIN"), resetThresholdConfig);

router.get("/access", authorize("ADMIN"), getAccessConfig);
router.put(
  "/access",
  authorize("ADMIN"),
  validate(updateAccessConfigSchema),
  updateAccessConfig
);

router.get("/who-datasets", authorize("ADMIN", "STAKEHOLDER"), getWhoDatasets);
router.get("/bootstrap-status", authorize("ADMIN"), getBootstrapStatus);
router.put(
  "/who-datasets/:id",
  authorize("ADMIN"),
  validate(updateWhoDatasetSchema),
  updateWhoDataset
);

export default router;
