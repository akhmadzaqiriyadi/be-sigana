import { Router } from "express";
import { authenticate } from "@/middlewares/auth";
import { notificationService } from "./notification.service";
import { env } from "@/config/env";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { sendSuccess } from "@/utils/response";

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

export default router;
