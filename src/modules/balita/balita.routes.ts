import { Router } from "express";
import {
  getAllBalitas,
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
 *     summary: Get all balitas (paginated)
 *     description: Fetch a paginated list of balitas with optional search and filter. Includes the latest measurement for each balita.
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
 *         name: search
 *         schema: { type: string }
 *         description: Search by namaAnak, namaOrtu, Village, or Posko
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Alias for search
 *       - in: query
 *         name: villageId
 *         schema: { type: integer }
 *         description: Filter by village ID
 *       - in: query
 *         name: poskoId
 *         schema: { type: integer }
 *         description: Filter by posko ID
 *     responses:
 *       200:
 *         description: Paginated list of balitas
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
 *                       namaAnak: { type: string }
 *                       namaOrtu: { type: string }
 *                       tanggalLahir: { type: string, format: date-time }
 *                       jenisKelamin: { type: string, enum: ['L', 'P'] }
 *                       villageId: { type: integer }
 *                       poskoId: { type: integer }
 *                       umurBulan: { type: integer, description: 'Calculated age in months' }
 *                       village:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           name: { type: string }
 *                           districts: { type: string }
 *                       posko:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id: { type: integer }
 *                           name: { type: string }
 *                       measurements:
 *                         type: array
 *                         description: Latest measurement only (max 1)
 *                         items:
 *                           type: object
 *                           properties:
 *                             id: { type: string, format: uuid }
 *                             statusAkhir: { type: string, enum: ['HIJAU', 'KUNING', 'MERAH'] }
 *                             createdAt: { type: string, format: date-time }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
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
 * /balitas/sync:
 *   post:
 *     tags:
 *       - Balita
 *     summary: Sync offline balita data
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
 *                     tanggalLahir: { type: string, format: 'date' }
 *                     jenisKelamin: { type: string, enum: ['L', 'P'] }
 *                     villageId: { type: integer }
 *                     poskoId: { type: integer }
 *                     createdAt: { type: string, format: 'date-time' }
 *     responses:
 *       200:
 *         description: Sync completed
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
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
import { validate } from "@/middlewares/validate";
import {
  createBalitaSchema,
  syncBalitaSchema,
} from "@/validations/master.validation";

const router = Router();

router.use(authenticate);

// Relawan can read and create
router.get("/", getAllBalitas);
router.post(
  "/sync",
  authorize("RELAWAN", "ADMIN"),
  validate(syncBalitaSchema),
  syncBalitas
);

router.get("/:id", getBalitaById);
router.post(
  "/",
  authorize("RELAWAN", "ADMIN"),
  validate(createBalitaSchema),
  createBalita
);

// Admin only for update and delete
router.put("/:id", authorize("ADMIN"), updateBalita);
router.delete("/:id", authorize("ADMIN"), deleteBalita);

export default router;
