import { Router } from "express";
import {
  generateReport,
  getReportStatus,
  downloadReport,
  getReportHistory,
} from "./report.controller";
import { authenticate } from "@/middlewares/auth";

const router = Router();

// All report endpoints require authentication
router.use(authenticate);

/**
 * @openapi
 * /reports/generate:
 *   post:
 *     tags:
 *       - Reports
 *     summary: Generate laporan gizi
 *     description: Membuat laporan gizi berdasarkan konfigurasi filter. Proses berjalan async — gunakan endpoint status untuk polling.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - period
 *               - format
 *             properties:
 *               period:
 *                 type: string
 *                 enum: [3_months, 6_months, 1_year, custom]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Wajib jika period = custom
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Wajib jika period = custom
 *               wilayah:
 *                 type: object
 *                 properties:
 *                   kecamatan:
 *                     type: string
 *                   desaIds:
 *                     type: array
 *                     items:
 *                       type: string
 *               statusGizi:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [Normal, Warning, Faltering, Gizi Buruk]
 *               parameterGrafik:
 *                 type: object
 *                 properties:
 *                   bbu:
 *                     type: boolean
 *                   pbu:
 *                     type: boolean
 *                   bbpb:
 *                     type: boolean
 *                   lku:
 *                     type: boolean
 *                   imtu:
 *                     type: boolean
 *                   lilau:
 *                     type: boolean
 *               faktorRisiko:
 *                 type: object
 *                 properties:
 *                   sanitasi:
 *                     type: boolean
 *                   ksi:
 *                     type: boolean
 *                   lilaRisiko:
 *                     type: boolean
 *               format:
 *                 type: string
 *                 enum: [pdf, excel, csv]
 *     responses:
 *       201:
 *         description: Laporan mulai diproses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     reportId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [processing]
 *                     estimatedTime:
 *                       type: number
 *                     downloadUrl:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: Validasi gagal
 *       401:
 *         description: Unauthorized
 */
router.post("/generate", generateReport);

/**
 * @openapi
 * /reports/history:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Riwayat laporan
 *     description: Mendapatkan daftar laporan yang pernah di-generate oleh pengguna saat ini (RELAWAN) atau semua pengguna (ADMIN/STAKEHOLDER).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Daftar laporan
 *       401:
 *         description: Unauthorized
 */
router.get("/history", getReportHistory);

/**
 * @openapi
 * /reports/{id}/status:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Status laporan (polling)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status laporan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     reportId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [processing, done, failed]
 *                     downloadUrl:
 *                       type: string
 *                       nullable: true
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       404:
 *         description: Laporan tidak ditemukan
 */
router.get("/:id/status", getReportStatus);

/**
 * @openapi
 * /reports/{id}/download:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Download file laporan
 *     description: Stream file laporan langsung ke browser. Mendukung PDF, Excel (xlsx), dan CSV.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Binary file stream
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Laporan tidak ditemukan atau belum selesai
 */
router.get("/:id/download", downloadReport);

export default router;
