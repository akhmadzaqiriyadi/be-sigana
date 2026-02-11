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
 * /balitas/sync:
 *   post:
 *     tags:
 *       - Balita
 *     summary: Sync offline balita data
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
