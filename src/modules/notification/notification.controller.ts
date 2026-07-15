import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { notificationService } from "./notification.service";
import { sendSuccess } from "@/utils/response";

export const getNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;
    const unread = req.query.unread === "true" ? true : undefined;
    const result = await notificationService.list(req.user!.userId, {
      limit,
      unread,
    });
    sendSuccess(res, "OK", result);
  }
);

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markRead(req.user!.userId, req.params.id);
  sendSuccess(res, "OK");
});

export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    await notificationService.markAllRead(req.user!.userId);
    sendSuccess(res, "OK");
  }
);
