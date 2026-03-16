import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import { validate } from "@/middlewares/validate";
import {
  getGrowthBootstrap,
  getGrowthDatasets,
  getGrowthVersion,
  getGrowthClassificationRules,
  updateGrowthClassificationRules,
  resetGrowthClassificationRules,
} from "./growth.controller";
import {
  growthDatasetsQuerySchema,
  updateGrowthClassificationRulesSchema,
} from "@/validations/master.validation";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /growth/bootstrap:
 *   get:
 *     tags: [Growth]
 *     summary: Bootstrap semua data referensi pertumbuhan
 *     description: >
 *       Mengembalikan threshold, classificationRules, dan datasetMeta dalam
 *       satu payload untuk bootstrap awal FE. Mendukung ETag/304.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data bootstrap berhasil diambil
 *       304:
 *         description: Data tidak berubah (ETag match)
 *       401:
 *         description: Tidak ter-autentikasi
 */
router.get("/bootstrap", getGrowthBootstrap);

/**
 * @openapi
 * /growth/datasets:
 *   get:
 *     tags: [Growth]
 *     summary: Ambil dataset LMS/SD-curve WHO
 *     description: >
 *       Mengembalikan baris data LMS mentah untuk satu atau beberapa
 *       indikator (measure) dan jenis kelamin (sex). Mendukung filter
 *       comma-separated.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: measure
 *         schema:
 *           type: string
 *         description: "Comma-separated: bb_u, tb_u, pb_u, bb_tb, bb_pb, lk_u, lila_u, imt_u"
 *       - in: query
 *         name: sex
 *         schema:
 *           type: string
 *         description: "Comma-separated: male, female"
 *     responses:
 *       200:
 *         description: Dataset berhasil diambil
 *       400:
 *         description: Filter tidak valid
 *       401:
 *         description: Tidak ter-autentikasi
 */
router.get("/datasets", validate(growthDatasetsQuerySchema), getGrowthDatasets);

/**
 * @openapi
 * /growth/version:
 *   get:
 *     tags: [Growth]
 *     summary: Ambil versi konfigurasi growth saat ini
 *     description: >
 *       Mengembalikan hash versi konfigurasi growth. Gunakan ETag untuk
 *       cache invalidation di FE.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Versi berhasil diambil
 *       304:
 *         description: Versi tidak berubah (ETag match)
 *       401:
 *         description: Tidak ter-autentikasi
 */
router.get("/version", getGrowthVersion);

/**
 * @openapi
 * /growth/classification-rules:
 *   get:
 *     tags: [Growth]
 *     summary: Ambil aturan klasifikasi status gizi
 *     description: >
 *       Mengembalikan definisi band + outlierAbs untuk semua 6 indikator.
 *       Override dari DB diutamakan; fallback ke nilai default Permenkes 2/2020.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aturan klasifikasi berhasil diambil
 *       401:
 *         description: Tidak ter-autentikasi
 */
router.get("/classification-rules", getGrowthClassificationRules);

/**
 * @openapi
 * /growth/classification-rules:
 *   put:
 *     tags: [Growth]
 *     summary: Perbarui aturan klasifikasi status gizi (Admin)
 *     description: >
 *       Memperbarui sebagian atau seluruh indikator. Input di-merge dengan
 *       konfigurasi saat ini — indikator yang tidak disertakan tidak berubah.
 *       Memerlukan role ADMIN.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Partial override per indikator (bb_u, tb_u, bb_tb, lk_u, lila_u, imt_u)
 *     responses:
 *       200:
 *         description: Aturan berhasil diperbarui
 *       400:
 *         description: Body tidak valid
 *       401:
 *         description: Tidak ter-autentikasi
 *       403:
 *         description: Bukan ADMIN
 */
router.put(
  "/classification-rules",
  authorize("ADMIN"),
  validate(updateGrowthClassificationRulesSchema),
  updateGrowthClassificationRules
);

/**
 * @openapi
 * /growth/classification-rules/reset:
 *   post:
 *     tags: [Growth]
 *     summary: Reset aturan klasifikasi ke nilai default (Admin)
 *     description: >
 *       Menghapus semua override dari DB dan mengembalikan nilai default
 *       Permenkes 2/2020. Memerlukan role ADMIN.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aturan berhasil direset
 *       401:
 *         description: Tidak ter-autentikasi
 *       403:
 *         description: Bukan ADMIN
 */
router.post(
  "/classification-rules/reset",
  authorize("ADMIN"),
  resetGrowthClassificationRules
);

export default router;
