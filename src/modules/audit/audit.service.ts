import prisma from "@/config/db";
import { logger } from "@/utils/logger";

type AuditContext = {
  actor?: string;
  target?: string;
  metadata?: Record<string, unknown>;
};

class AuditService {
  private async isAuditEnabled(): Promise<boolean> {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "access" },
    });

    if (!config || typeof config.value !== "object" || !config.value) {
      return true;
    }

    const parsed = config.value as { auditLogging?: unknown };
    return parsed.auditLogging !== false;
  }

  async log(event: string, context: AuditContext = {}) {
    const enabled = await this.isAuditEnabled();
    if (!enabled) {
      return;
    }

    logger.info(
      JSON.stringify({
        kind: "audit",
        event,
        actor: context.actor ?? "system",
        target: context.target ?? null,
        metadata: context.metadata ?? null,
        timestamp: new Date().toISOString(),
      })
    );
  }
}

export const auditService = new AuditService();
