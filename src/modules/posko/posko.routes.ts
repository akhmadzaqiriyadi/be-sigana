import { Router } from "express";
import {
  getAllPoskos,
  getPoskoById,
  createPosko,
  updatePosko,
  deletePosko,
  getMapData,
} from "./posko.controller";
import { authenticate, authorize } from "../../middlewares/auth";

/**
 * @openapi
 * /poskos:
 *   get:
 *     tags:
 *       - Posko
 *     summary: Get all poskos
 *     parameters:
 *       - in: query
 *         name: villageId
 *         schema:
 *           type: integer
 *         description: Filter poskos by village ID
 *     responses:
 *       200:
 *         description: List of poskos
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
 *                     $ref: '#/components/schemas/Posko'
 *   post:
 *     tags:
 *       - Posko
 *     summary: Create new posko (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - villageId
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Posko Mawar 01'
 *               villageId:
 *                 type: integer
 *               latitude:
 *                 type: number
 *                 example: -6.2088
 *               longitude:
 *                 type: number
 *                 example: 106.8456
 *     responses:
 *       201:
 *         description: Posko created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Posko'
 *
 * /poskos/map:
 *   get:
 *     tags:
 *       - Posko
 *     summary: Get posko data for map visualization
 *     responses:
 *       200:
 *         description: Map data retrieved
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
 *                     $ref: '#/components/schemas/Posko'
 */
import { validate } from "../../middlewares/validate";
import { createPoskoSchema } from "../../validations/master.validation";

const router = Router();

router.use(authenticate);

// Anyone authenticated can read
router.get("/", getAllPoskos);
router.get("/map", getMapData);
router.get("/:id", getPoskoById);

// Admin only for write operations
router.post("/", authorize("ADMIN"), validate(createPoskoSchema), createPosko);
router.put("/:id", authorize("ADMIN"), updatePosko);
router.delete("/:id", authorize("ADMIN"), deletePosko);

export default router;
