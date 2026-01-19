import { Router } from 'express';
import {
  getAllVillages,
  getVillageById,
  createVillage,
  updateVillage,
  deleteVillage,
} from './village.controller';
import { authenticate, authorize } from '../../middlewares/auth';

/**
 * @openapi
 * /villages:
 *   get:
 *     tags:
 *       - Village
 *     summary: Get all villages
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search villages by name
 *     responses:
 *       200:
 *         description: List of villages
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
 *                     $ref: '#/components/schemas/Village'
 *   post:
 *     tags:
 *       - Village
 *     summary: Create new village (Admin only)
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
 *               - districts
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Desa Sukamaju'
 *               districts:
 *                 type: string
 *                 example: 'Kecamatan Melati'
 *     responses:
 *       201:
 *         description: Village created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Village'
 *       400:
 *         description: Village already exists
 */
import { validate } from '../../middlewares/validate';
import { createVillageSchema } from '../../validations/master.validation';

const router = Router();

router.use(authenticate);

// Anyone authenticated can read
router.get('/', getAllVillages);
router.get('/:id', getVillageById);

// Admin only for write operations
router.post('/', authorize('ADMIN'), validate(createVillageSchema), createVillage);
router.put('/:id', authorize('ADMIN'), updateVillage);
router.delete('/:id', authorize('ADMIN'), deleteVillage);

export default router;
