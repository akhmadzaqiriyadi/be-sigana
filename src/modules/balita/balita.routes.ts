import { Router } from "express";
import {
  getAllBalitas,
  getBalitaById,
  createBalita,
  updateBalita,
  deleteBalita,
} from "./balita.controller";
import { authenticate, authorize } from "@/middlewares/auth";

/**
 * @openapi
 * /balitas:
 *   get:
 *     tags:
 *       - Balita
 *     summary: Get all balitas
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: villageId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of balitas retrieved
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
 *                     $ref: '#/components/schemas/Balita'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     totalPages: { type: integer }
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 *   post:
 *     tags:
 *       - Balita
 *     summary: Create new balita
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - namaAnak
 *               - namaOrtu
 *               - tanggalLahir
 *               - jenisKelamin
 *               - villageId
 *             properties:
 *               namaAnak: { type: string, example: 'Ayu Lestari' }
 *               namaOrtu: { type: string, example: 'Siti Aminah' }
 *               tanggalLahir: { type: string, format: 'date', example: '2023-05-15' }
 *               jenisKelamin: { type: string, enum: ['L', 'P'] }
 *               villageId: { type: integer }
 *               poskoId: { type: string, format: 'uuid' }
 *     responses:
 *       201:
 *         description: Balita created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Balita' }
 *       400:
 *         description: Validation Error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal Server Error
 *
 * /balitas/{id}:
 *   get:
 *     tags:
 *       - Balita
 *     summary: Get balita by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Balita details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Balita' }
 *       404:
 *         description: Balita not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
import { validate } from "@/middlewares/validate";
import { createBalitaSchema } from "@/validations/master.validation";

const router = Router();

router.use(authenticate);

// Relawan can read and create
router.get("/", getAllBalitas);
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
