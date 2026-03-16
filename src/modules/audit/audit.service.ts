import prisma from "@/config/db";
import { logger } from "@/utils/logger";

type AuditContext = {
  actor?: string;
  target?: string;
  ipAddress?: string;
  device?: string;
  metadata?: Record<string, unknown>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseEvent = (event: string): { module: string; action: string } => {
  const [module, ...actionParts] = event.split(".");
  return {
    module: module || "system",
    action: actionParts.join(".") || "unknown",
  };
};

const toUserIdOrNull = (value?: string): string | null => {
  if (!value) {
    return null;
  }
  return UUID_REGEX.test(value) ? value : null;
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

    const { module, action } = parseEvent(event);
    const actorId = toUserIdOrNull(context.actor);
    const targetId = toUserIdOrNull(context.target);
    const metadata: Record<string, unknown> = context.metadata
      ? { ...context.metadata }
      : {};
    if (context.actor && !actorId) {
      metadata.actorIdentifier = context.actor;
    }
    if (context.target && !targetId) {
      metadata.targetIdentifier = context.target;
    }

    try {
      await prisma.auditLog.create({
        data: {
          event,
          module,
          action,
          actorId,
          targetId,
          ipAddress: context.ipAddress,
          device: context.device,
          metadata,
        },
      });
    } catch (error) {
      logger.warn(`Failed to persist audit log: ${String(error)}`);
    }

    logger.info(
      JSON.stringify({
        kind: "audit",
        event,
        actor: context.actor ?? "system",
        target: context.target ?? null,
        metadata,
        module,
        action,
        ipAddress: context.ipAddress ?? null,
        device: context.device ?? null,
        timestamp: new Date().toISOString(),
      })
    );
  }
}

export const auditService = new AuditService();
