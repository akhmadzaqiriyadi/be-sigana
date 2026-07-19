import { Router } from "express";
import { authenticate } from "@/middlewares/auth";
import { notificationService } from "./notification.service";
import { env } from "@/config/env";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "./notification.controller";

/**
 * @openapi
 * /notifications/vapid-key:
 *   get:
 *     tags: [Notification]
 *     summary: Ambil public key VAPID untuk push notification
 *     description: >
 *       Mengembalikan public key VAPID yang digunakan untuk
 *       mengenkripsi push notification di sisi klien (FE).
 *     responses:
 *       200:
 *         description: Public key berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     publicKey: { type: string }
 *
 * @openapi
 * /notifications/subscribe:
 *   post:
 *     tags: [Notification]
 *     summary: Subscribe ke push notification
 *     description: >
 *       Mendaftarkan subscription endpoint perangkat pengguna untuk
 *       menerima push notification.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint, keys]
 *             properties:
 *               endpoint:
 *                 type: string
 *                 description: Endpoint URL dari PushSubscription
 *               keys:
 *                 type: object
 *                 required: [p256dh, auth]
 *                 properties:
 *                   p256dh:
 *                     type: string
 *                     description: Kunci publik P-256 (base64 encoded)
 *                   auth:
 *                     type: string
 *                     description: Token auth (base64 encoded)
 *     responses:
 *       200:
 *         description: Berhasil subscribe
 *       401:
 *         description: Tidak ter-autentikasi
 *
 * @openapi
 * /notifications/unsubscribe:
 *   post:
 *     tags: [Notification]
 *     summary: Unsubscribe dari push notification
 *     description: >
 *       Menghapus subscription endpoint tertentu dari database
 *       sehingga pengguna tidak lagi menerima push notification.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint]
 *             properties:
 *               endpoint:
 *                 type: string
 *                 description: Endpoint URL yang ingin dihapus
 *     responses:
 *       200:
 *         description: Berhasil unsubscribe
 *       401:
 *         description: Tidak ter-autentikasi
 *
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notification]
 *     summary: Ambil daftar notifikasi
 *     description: >
 *       Mengembalikan daftar notifikasi milik pengguna yang sedang login.
 *       Mendukung paginasi dan filter notifikasi yang belum dibaca.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Halaman yang diminta
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Jumlah item per halaman
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean, default: false }
 *         description: Jika true, hanya tampilkan notifikasi yang belum dibaca
 *     responses:
 *       200:
 *         description: Daftar notifikasi berhasil diambil
 *       401:
 *         description: Tidak ter-autentikasi
 *
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notification]
 *     summary: Tandai satu notifikasi sebagai sudah dibaca
 *     description: >
 *       Mengubah status notifikasi tertentu menjadi read (dibaca).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID notifikasi
 *     responses:
 *       200:
 *         description: Notifikasi berhasil ditandai sebagai read
 *       401:
 *         description: Tidak ter-autentikasi
 *       404:
 *         description: Notifikasi tidak ditemukan
 *
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     tags: [Notification]
 *     summary: Tandai semua notifikasi sebagai sudah dibaca
 *     description: >
 *       Mengubah status semua notifikasi milik pengguna yang belum dibaca
 *       menjadi read.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Semua notifikasi berhasil ditandai sebagai read
 *       401:
 *         description: Tidak ter-autentikasi
 */

const router = Router();

router.get("/vapid-key", (req, res) => {
  res.json({ success: true, data: { publicKey: env.VAPID_PUBLIC_KEY } });
});

router.post(
  "/subscribe",
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationService.subscribe(
      req.user!.userId,
      req.body.subscription
    );
    sendSuccess(res, "Subscribed to push notifications");
  })
);

router.post(
  "/unsubscribe",
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationService.unsubscribe(req.user!.userId, req.body.endpoint);
    sendSuccess(res, "Unsubscribed from push notifications");
  })
);

router.get("/", authenticate, getNotifications);
router.patch("/:id/read", authenticate, markAsRead);
router.patch("/read-all", authenticate, markAllAsRead);

export default router;
