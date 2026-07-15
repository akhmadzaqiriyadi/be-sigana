import webpush from "web-push";
import prisma from "@/config/db";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { NotFoundError } from "@/utils/ApiError";
import { Role } from "@prisma/client";

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

let _vapidInitialized = false;
function ensureVapid() {
  if (_vapidInitialized) return;
  webpush.setVapidDetails(
    "mailto:noreply@sigana.id",
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!
  );
  _vapidInitialized = true;
}

export class NotificationService {
  async subscribe(userId: string, subscription: any) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User tidak ditemukan");

    const existing = (user.pushSubscriptions as any[]) || [];
    if (existing.some((s: any) => s.endpoint === subscription.endpoint)) return;

    await prisma.user.update({
      where: { id: userId },
      data: {
        pushSubscriptions: [
          ...existing,
          { ...subscription, createdAt: new Date().toISOString() },
        ],
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const existing = (user?.pushSubscriptions as any[]) || [];
    await prisma.user.update({
      where: { id: userId },
      data: {
        pushSubscriptions: existing.filter((s: any) => s.endpoint !== endpoint),
      },
    });
  }

  async create(input: {
    userId: string;
    title: string;
    body?: string;
    type?: string;
    data?: Record<string, unknown>;
  }) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body || null,
        type: input.type || "system",
        data: (input.data as any) || undefined,
      },
    });
  }

  async list(userId: string, opts?: { limit?: number; unread?: boolean }) {
    const limit = opts?.limit || 20;
    const where: any = { userId };
    if (opts?.unread) where.isRead = false;

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    return prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async sendToUser(userId: string, payload: PushPayload) {
    ensureVapid();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushSubscriptions: true },
    });
    if (!user?.pushSubscriptions) return;

    const subscriptions = user.pushSubscriptions as any[];
    if (subscriptions.length === 0) return;

    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(sub, JSON.stringify(payload))
      )
    );

    const expiredEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const err = r.reason as any;
        if (err?.statusCode === 410) {
          expiredEndpoints.push(subscriptions[i].endpoint);
        }
      }
    });

    if (expiredEndpoints.length > 0) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const existing = (user?.pushSubscriptions as any[]) || [];
      await prisma.user.update({
        where: { id: userId },
        data: {
          pushSubscriptions: existing.filter(
            (s: any) => !expiredEndpoints.includes(s.endpoint)
          ),
        },
      });
      logger.info(
        { userId, count: expiredEndpoints.length },
        "Cleaned expired push subs"
      );
    }
  }

  async sendToRole(role: Role, payload: PushPayload) {
    const users = await prisma.user.findMany({
      where: { role, pushSubscriptions: { not: null } },
      select: { id: true },
    });
    for (const user of users) {
      await this.sendToUser(user.id, payload).catch((err) =>
        logger.error({ err, userId: user.id }, "Push send failed")
      );
    }
  }
}

export const notificationService = new NotificationService();
