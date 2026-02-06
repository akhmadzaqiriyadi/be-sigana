import { Router } from "express";
import {
  register,
  login,
  getProfile,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
} from "./auth.controller";
import { authenticate } from "@/middlewares/auth";

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: 'object'
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: 'string'
 *                 example: 'relawan@sigana.id'
 *               password:
 *                 type: 'string'
 *                 example: 'password123'
 *               name:
 *                 type: 'string'
 *                 example: 'Budi Santoso'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 success:
 *                   type: 'boolean'
 *                   example: true
 *                 message:
 *                   type: 'string'
 *                   example: 'Pendaftaran berhasil. Silakan tunggu persetujuan admin.'
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad Request
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Email sudah terdaftar'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: 'object'
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: 'string'
 *                 example: 'admin@sigana.id'
 *               password:
 *                 type: 'string'
 *                 example: 'admin123'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 success:
 *                   type: 'boolean'
 *                   example: true
 *                 message:
 *                   type: 'string'
 *                   example: 'Login berhasil'
 *                 data:
 *                   type: 'object'
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: 'string'
 *                       example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Email dan password wajib diisi'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Email atau password salah'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Refresh access token
 *     description: Exchange a valid refresh token (from httpOnly cookie) for a new access token. Rotates the refresh token securely.
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 success:
 *                   type: 'boolean'
 *                   example: true
 *                 message:
 *                   type: 'string'
 *                   example: 'Token berhasil diperbarui'
 *                 data:
 *                   type: 'object'
 *                   properties:
 *                     accessToken:
 *                       type: 'string'
 *                       example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *       400:
 *         description: Refresh token required
 *       403:
 *         description: Invalid or expired refresh token (or reuse detected)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Token tidak valid atau kadaluarsa'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Logout user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 success:
 *                   type: 'boolean'
 *                   example: true
 *                 message:
 *                   type: 'string'
 *                   example: 'Logout berhasil'
 *                 data:
 *                   type: 'null'
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
 *
 * /auth/profile:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 success:
 *                   type: 'boolean'
 *                   example: true
 *                 message:
 *                   type: 'string'
 *                   example: 'Profil berhasil diambil'
 *                 data:
 *                   $ref: '#/components/schemas/User'

 *
 * /auth/forgot-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Request password reset link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: 'object'
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: 'string'
 *     responses:
 *       200:
 *         description: Success (always returns 200 for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 success:
 *                   type: 'boolean'
 *                   example: true
 *                 message:
 *                   type: 'string'
 *                   example: 'Jika email terdaftar, link reset password telah dikirim.'
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Format email tidak valid'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /auth/reset-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Reset password with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: 'object'
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: 'string'
 *               password:
 *                 type: 'string'
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 success:
 *                   type: 'boolean'
 *                   example: true
 *                 message:
 *                   type: 'string'
 *                   example: 'Password berhasil diubah. Silakan login kembali.'
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: 'Token tidak valid atau sudah kadaluarsa'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
import { validate } from "@/middlewares/validate";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/validations/auth.validation";

const router = Router();

// Routes
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", authenticate, logout);

router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.get("/profile", authenticate, getProfile);
router.get("/me", authenticate, getProfile); // Alias for /profile

export default router;
