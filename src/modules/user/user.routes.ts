import { Router } from "express";
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  verifyUser,
  deleteUser,
  getPendingUsers,
  updateProfile,
} from "./user.controller";
import { authenticate, authorize } from "@/middlewares/auth";
import { validate } from "@/middlewares/validate";
import { verifyUserSchema } from "@/validations/master.validation";
import {
  updateProfileSchema,
  createUserSchema,
} from "@/validations/auth.validation";

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
 *                   example: 'Data pengguna berhasil diambil'
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
 *               message: 'Akses ditolak. Memerlukan peran Admin.'
 *   post:
 *     tags:
 *       - User
 *     summary: Create user (Admin only)
 *     description: Create a new user with admin privileges. Created users are verified by default.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'newuser@example.com'
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: 'password123'
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 example: 'John Doe'
 *               role:
 *                 type: string
 *                 enum: [ADMIN, RELAWAN, STAKEHOLDER]
 *                 example: 'RELAWAN'
 *               isVerified:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: User created successfully
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
 *                   example: 'Pengguna berhasil dibuat'
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       409:
 *         description: Email already registered
 *
 * /users/profile:
 *   patch:
 *     tags:
 *       - User
 *     summary: Update profile
 *     description: Update current user's profile information.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 example: 'New Name'
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: 'Profil berhasil diperbarui'
 *                 data:
 *                   $ref: '#/components/schemas/User'
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
 *                   example: 'Pengguna berhasil diverifikasi'
 *       404:
 *         description: User not found
 */

const router = Router();

// All routes require authentication
router.use(authenticate);

// Profile routes (Must be before /:id)
router.patch("/profile", validate(updateProfileSchema), updateProfile);

// Admin only routes
router.post("/", authorize("ADMIN"), validate(createUserSchema), createUser);
router.get("/", authorize("ADMIN"), getAllUsers);
router.get("/pending", authorize("ADMIN"), getPendingUsers);
router.get("/:id", authorize("ADMIN"), getUserById);
router.put("/:id", authorize("ADMIN"), updateUser);
router.patch(
  "/:id/verify",
  authorize("ADMIN"),
  validate(verifyUserSchema),
  verifyUser
);
router.delete("/:id", authorize("ADMIN"), deleteUser);

export default router;
