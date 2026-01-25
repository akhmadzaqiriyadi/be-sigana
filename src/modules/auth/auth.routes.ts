import { Router } from 'express';
import { register, login, getProfile, logout } from './auth.controller';
import { authenticate } from '../../middlewares/auth';

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
 *                   example: 'Registration successful. Please wait for admin approval.'
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad Request
 *       409:
 *         description: Email already registered
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
 *                   example: 'Login successful'
 *                 data:
 *                   type: 'object'
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: 'string'
 *                       example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
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
 *                   example: 'Logout successful'
 *                 data:
 *                   type: 'null'
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
 *                   example: 'Profile retrieved successfully'
 *                 data:
 *                   $ref: '#/components/schemas/User'
 */
import { validate } from '../../middlewares/validate';
import { loginSchema, registerSchema } from '../../validations/auth.validation';

const router = Router();

// Routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.get('/me', authenticate, getProfile); // Alias for /profile

export default router;
