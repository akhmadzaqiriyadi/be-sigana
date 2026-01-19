import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  verifyUser,
  deleteUser,
  getPendingUsers,
} from './user.controller';
import { authenticate, authorize } from '../../middlewares/auth';

/**
 * @openapi
 * /users:
 *   get:
 *     tags:
 *       - User
 *     summary: Get all users (Admin only)
 *     description: Retrieve a paginated list of all registered users. Requires Admin privileges.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Users retrieved successfully'
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden (Non-Admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Access denied. Admin role required.'
 * 
 * /users/pending:
 *   get:
 *     tags:
 *       - User
 *     summary: Get pending users (Admin only)
 *     description: Retrieve users who have registered but not yet verified.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending users
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
 *                     $ref: '#/components/schemas/User'
 * 
 * /users/{id}/verify:
 *   patch:
 *     tags:
 *       - User
 *     summary: Verify user (Admin only)
 *     description: Approve a user's registration.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'User verified successfully'
 *       404:
 *         description: User not found
 */
import { validate } from '../../middlewares/validate';
import { verifyUserSchema } from '../../validations/master.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Admin only routes
router.get('/', authorize('ADMIN'), getAllUsers);
router.get('/pending', authorize('ADMIN'), getPendingUsers);
router.get('/:id', authorize('ADMIN'), getUserById);
router.put('/:id', authorize('ADMIN'), updateUser);
router.patch('/:id/verify', authorize('ADMIN'), validate(verifyUserSchema), verifyUser);
router.delete('/:id', authorize('ADMIN'), deleteUser);

export default router;
