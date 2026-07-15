import { describe, expect, it, mock, beforeEach } from "bun:test";

mock.module("web-push", () => ({
  default: {
    setVapidDetails: mock(),
    sendNotification: mock(),
  },
}));

mock.module("../../config/db", () => ({
  default: {
    notification: {
      create: mock(),
      findMany: mock(),
      count: mock(),
      update: mock(),
      updateMany: mock(),
    },
    user: {
      findUnique: mock(),
      update: mock(),
    },
  },
}));

import { NotificationService } from "./notification.service";
import prisma from "@/config/db";

describe("NotificationService", () => {
  let svc: NotificationService;

  beforeEach(() => {
    svc = new NotificationService();
  });

  it("create should save notification to DB", async () => {
    (prisma.notification.create as any).mockResolvedValue({
      id: "n1",
      title: "Test",
      isRead: false,
    });

    const result = await svc.create({
      userId: "u1",
      title: "Test",
      body: "msg",
      type: "merah",
    });

    expect(result.id).toBe("n1");
  });

  it("list should return notifications for user with unread filter", async () => {
    (prisma.notification.findMany as any).mockResolvedValue([
      { id: "n1", isRead: false },
      { id: "n2", isRead: true },
    ]);
    (prisma.notification.count as any).mockResolvedValue(1);

    const result = await svc.list("u1", { limit: 10, unread: true });

    expect(result.items.length).toBe(2);
    expect(result.unreadCount).toBe(1);
  });

  it("markRead should update single notification", async () => {
    (prisma.notification.update as any).mockResolvedValue({
      id: "n1",
      isRead: true,
    });

    const result = await svc.markRead("u1", "n1");

    expect(result.isRead).toBe(true);
  });

  it("markAllRead should update all unread for user", async () => {
    (prisma.notification.updateMany as any).mockResolvedValue({ count: 5 });

    const result = await svc.markAllRead("u1");

    expect(result.count).toBe(5);
  });

  it("measurement with KUNING status should create notification", async () => {
    const createSpy = mock();
    (prisma.notification.create as any) = createSpy;
    (prisma.user.findUnique as any).mockResolvedValue({
      pushSubscriptions: [
        { endpoint: "https://fcm/x", keys: { auth: "a", p256dh: "b" } },
      ],
    });
    (prisma.notification.findMany as any).mockResolvedValue([]);
    (prisma.notification.count as any).mockResolvedValue(1);

    await svc.sendToUser(
      "r1",
      {
        title: "Perlu Pemantauan",
        body: "Status KUNING",
        tag: "follow-up-required",
        data: { measurementId: "m1" },
        requireInteraction: true,
      },
      "kuning"
    );

    expect(createSpy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "r1",
        title: "Perlu Pemantauan",
        type: "kuning",
      }),
    });
  });
});
