import cron from "node-cron";
import prisma from "@/config/db";
import { notificationService } from "./notification.service";
import { logger } from "@/utils/logger";

export function scheduleDailyReminder() {
  cron.schedule("0 8 * * *", async () => {
    logger.info("[Push Cron] Running daily follow-up reminder");

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const pending = await prisma.measurement.groupBy({
        by: ["relawanId"],
        where: {
          statusAkhir: { in: ["KUNING", "MERAH"] },
          createdAt: { gte: thirtyDaysAgo },
          deletedAt: null,
          relawanId: { not: null },
        },
        _count: { relawanId: true },
      });

      for (const row of pending) {
        if (!row.relawanId) continue;
        await notificationService
          .sendToUser(row.relawanId, {
            title: "Jadwal Tindak Lanjut Hari Ini",
            body:
              row._count.relawanId +
              " anak perlu ditindaklanjuti. Buka SiGana untuk detail.",
            tag: "follow-up-today",
            data: { count: row._count.relawanId },
          })
          .catch((err) => {
            logger.error(
              { err, relawanId: row.relawanId },
              "[Push Cron] send failed"
            );
          });
      }

      logger.info(
        { userCount: pending.length },
        "[Push Cron] Daily reminder complete"
      );
    } catch (err) {
      logger.error({ err }, "[Push Cron] Failed");
    }
  });
}
