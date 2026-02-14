import { Router } from "express";
import { validate } from "@/middlewares/validate";
import {
  createMeasurementSchema,
  getMeasurementSchema,
  syncMeasurementSchema,
  syncPullSchema,
} from "@/validations/measurement.validation";
import {
  getAllMeasurements,
  getMeasurementById,
  createMeasurement,
  syncMeasurements,
  syncPull,
  getStatistics,
  deleteMeasurement,
} from "./measurement.controller";
import { authenticate, authorize } from "@/middlewares/auth";

/**
 * @openapi
 * /measurements:
 *   get:
 *     tags:
 *       - Measurement
 *     summary: Get all measurements (paginated)
 *     description: Fetch paginated measurements with optional filters. RELAWAN users only see their own measurements.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Items per page
 *       - in: query
 *         name: balitaId
 *         schema: { type: string, format: uuid }
 *         description: Filter by balita ID
 *       - in: query
 *         name: relawanId
 *         schema: { type: string, format: uuid }
 *         description: Filter by relawan ID (Admin/Stakeholder only)
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [HIJAU, KUNING, MERAH] }
 *         description: Filter by nutritional status
 *       - in: query
 *         name: updatedAfter
 *         schema: { type: string, format: date-time }
 *         description: Filter measurements updated after this ISO 8601 timestamp (for delta sync)
 *       - in: query
 *         name: createdAfter
 *         schema: { type: string, format: date-time }
 *         description: Filter measurements created after this ISO 8601 timestamp
 *     responses:
 *       200:
 *         description: Paginated list of measurements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Measurement' }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Format status tidak valid'
 *       401:
 *         description: Unauthorized
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
 *   post:
 *     tags:
 *       - Measurement
 *     summary: Create new measurement (Single)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [balitaId, beratBadan, tinggiBadan]
 *             properties:
 *               balitaId: { type: string, format: uuid }
 *               beratBadan: { type: number, example: 8.5 }
 *               tinggiBadan: { type: number, example: 75.0 }
 *               lingkarKepala: { type: number, example: 45.0 }
 *               lila: { type: number, example: 14.5 }
 *               posisiUkur: { type: string, enum: [TERLENTANG, BERDIRI] }
 *     responses:
 *       201:
 *         description: Measurement created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Measurement' }
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Berat badan harus berupa angka'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Belum terautentikasi'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Akses ditolak'
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
 * /measurements/sync-pull:
 *   get:
 *     tags:
 *       - Measurement
 *     summary: Pull measurements updated since last sync (Delta Sync)
 *     description: Fetch measurements created, updated, or soft-deleted since the given timestamp. RELAWAN users only see their own data. Returns tombstones (deletedAt) for handling server-side deletions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lastSync
 *         required: true
 *         schema: { type: string, format: date-time }
 *         description: ISO 8601 timestamp of the last sync
 *         example: '2024-01-01T00:00:00.000Z'
 *     responses:
 *       200:
 *         description: Delta sync data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       localId: { type: string, nullable: true, description: 'Maps back to local IndexedDB ID' }
 *                       balitaId: { type: string, format: uuid }
 *                       beratBadan: { type: number }
 *                       tinggiBadan: { type: number }
 *                       lingkarKepala: { type: number }
 *                       lila: { type: number }
 *                       posisiUkur: { type: string, enum: [TERLENTANG, BERDIRI] }
 *                       bb_u_status: { type: string }
 *                       tb_u_status: { type: string }
 *                       bb_tb_status: { type: string }
 *                       statusAkhir: { type: string, enum: [HIJAU, KUNING, MERAH] }
 *                       notes: { type: string, nullable: true }
 *                       sanitationData: { type: object, nullable: true }
 *                       medicalHistoryData: { type: object, nullable: true }
 *                       updatedAt: { type: string, format: date-time }
 *                       deletedAt: { type: string, format: date-time, nullable: true, description: 'Tombstone for downstream deletion' }
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Format tanggal harus ISO 8601'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Belum terautentikasi'
 *
 * /measurements/sync:
 *   post:
 *     tags:
 *       - Measurement
 *     summary: Sync offline measurements
 *     description: Submit multiple measurements collected offline.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               measurements:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     localId: { type: string, example: 'loc-1' }
 *                     balitaId: { type: string, format: uuid }
 *                     beratBadan: { type: number, example: 8.5 }
 *                     tinggiBadan: { type: number, example: 75.0 }
 *                     lingkarKepala: { type: number, example: 45.0 }
 *                     lila: { type: number, example: 14.5 }
 *                     posisiUkur: { type: string, enum: [TERLENTANG, BERDIRI] }
 *                     recordedAt: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Sync successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Data pengukuran berhasil disinkronisasi' }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Measurement' }
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Format data sync tidak valid'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Belum terautentikasi'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Akses ditolak'
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

// Read access for all authenticated users
router.get("/", validate(getMeasurementSchema), getAllMeasurements);
router.get("/sync-pull", validate(syncPullSchema), syncPull);
router.get(
  "/stats",
  authorize("ADMIN", "STAKEHOLDER", "RELAWAN"),
  getStatistics
);
router.get("/:id", getMeasurementById);

// Relawan and Admin can create measurements
router.post(
  "/",
  authorize("RELAWAN", "ADMIN"),
  validate(createMeasurementSchema),
  createMeasurement
);
router.post(
  "/sync",
  authorize("RELAWAN", "ADMIN"),
  validate(syncMeasurementSchema),
  syncMeasurements
);

// Admin only for delete
router.delete("/:id", authorize("ADMIN"), deleteMeasurement);

export default router;
