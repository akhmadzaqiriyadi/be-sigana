import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import {
  getSystemInfo,
  getSystemLogs,
  triggerSystemBackup,
} from "./system.controller";

/**
 * @openapi
 * /system/info:
 *   get:
 *     tags:
 *       - System
 *     summary: Informasi sistem
 *     description: Mengambil informasi server, uptime, memory, dan status database. Hanya untuk admin.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informasi sistem berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 success:
 *                   type: 'boolean'
 *                   example: true
 *                 data:
 *                   type: 'object'
 *                   properties:
 *                     uptime:
 *                       type: 'number'
 *                       example: 3600
 *                     memory:
 *                       type: 'object'
 *                       properties:
 *                         usage:
 *                           type: 'string'
 *                           example: '45%'
 *                     dbStatus:
 *                       type: 'string'
 *                       example: 'connected'
 *       401:
 *         description: Tidak terautentikasi
 *       403:
 *         description: Tidak memiliki akses admin
 *       500:
 *         description: Internal Server Error
 *
 * /system/backup:
 *   post:
 *     tags:
 *       - System
 *     summary: Trigger backup database
 *     description: Memicu proses backup database. Hanya untuk admin.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup berhasil dimulai
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
 *                   example: 'Backup database berhasil dimulai'
 *                 data:
 *                   type: 'object'
 *                   properties:
 *                     backupId:
 *                       type: 'string'
 *                       example: 'bck_20240719_123456'
 *                     startedAt:
 *                       type: 'string'
 *                       format: 'date-time'
 *                       example: '2024-07-19T12:34:56.000Z'
 *       401:
 *         description: Tidak terautentikasi
 *       403:
 *         description: Tidak memiliki akses admin
 *       500:
 *         description: Internal Server Error
 *
 * /system/logs:
 *   get:
 *     tags:
 *       - System
 *     summary: Ambil log aplikasi
 *     description: Mengambil log aplikasi dengan filter level opsional. Hanya untuk admin.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: 'string'
 *           enum:
 *             - error
 *             - warn
 *             - info
 *             - debug
 *         description: Filter berdasarkan level log
 *       - in: query
 *         name: limit
 *         schema:
 *           type: 'integer'
 *           default: 100
 *         description: Jumlah log yang diambil
 *     responses:
 *       200:
 *         description: Log berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 success:
 *                   type: 'boolean'
 *                   example: true
 *                 data:
 *                   type: 'array'
 *                   items:
 *                     type: 'object'
 *                     properties:
 *                       timestamp:
 *                         type: 'string'
 *                         example: '2024-07-19T12:00:00.000Z'
 *                       level:
 *                         type: 'string'
 *                         example: 'info'
 *                       message:
 *                         type: 'string'
 *                         example: 'Server started'
 *       401:
 *         description: Tidak terautentikasi
 *       403:
 *         description: Tidak memiliki akses admin
 *       500:
 *         description: Internal Server Error
 */

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/info", getSystemInfo);
router.post("/backup", triggerSystemBackup);
router.get("/logs", getSystemLogs);

export default router;
