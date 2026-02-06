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
 *     summary: Get all measurements
 *     parameters:
 *       - in: query
 *         name: balitaId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [HIJAU, KUNING, MERAH] }
 *     responses:
 *       200:
 *         description: List of measurements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
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
 * /measurements/sync:
 *   post:
 *     tags:
 *       - Measurement
 *     summary: Sync offline measurements
 *     description: Submit multiple measurements collected offline.
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
router.get("/stats", authorize("ADMIN", "STAKEHOLDER"), getStatistics);
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
