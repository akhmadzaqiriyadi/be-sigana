import { Prisma } from "@prisma/client";
import prisma from "@/config/db";
import { NotFoundError } from "@/utils/ApiError";
import { auditService } from "@/modules/audit/audit.service";
import {
  accessConfigSchema,
  thresholdConfigSchema,
} from "@/validations/master.validation";

const DEFAULT_THRESHOLD_CONFIG = {
  minDataPoints: 3,
  warningEnabled: true,
  falteringThreshold: 2,
  badgeColors: {
    normal: "#22c55e",
    warning: "#eab308",
    faltering: "#f97316",
    giziBuruk: "#ef4444",
  },
};

const DEFAULT_ACCESS_CONFIG = {
  auditLogging: true,
  sessionTimeout: 30,
  multiDeviceLogin: false,
  emailVerification: true,
};

const EXPECTED_KBM_MONTHS = Array.from({ length: 61 }, (_, month) => month);

interface UpdateWhoDatasetInput {
  code?: string;
  label?: string;
  description?: string;
  version?: string;
  lastUpdated?: string;
  ageRange?: string;
  isActive?: boolean;
  updatedBy?: string;
}

type WhoDatasetRow = {
  id: number;
  code: string;
  label: string;
  description: string;
  version: string;
  lastUpdated: Date;
  ageRange: string;
  isActive: boolean;
  updatedAt: Date;
  updatedBy: string | null;
};

type WhoDatasetMappedResponse = {
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  version: string;
  lastUpdated: Date;
  ageRange: string;
  isActive: boolean;
  sourceCodes: string[];
};

const WHO_DATASET_DISPLAY_MAPPING: Array<{
  code: string;
  label: string;
  shortLabel: string;
  sourceCodes: string[];
}> = [
  {
    code: "BB_U",
    label: "BB/U Dataset",
    shortLabel: "WFA",
    sourceCodes: ["BB_U"],
  },
  {
    code: "PB_U",
    label: "PB/U atau TB/U Dataset",
    shortLabel: "LFA/HFA",
    sourceCodes: ["PB_U", "TB_U"],
  },
  {
    code: "BB_TB",
    label: "BB/TB atau BB/PB Dataset",
    shortLabel: "WFL/WFH",
    sourceCodes: ["BB_TB", "BB_PB"],
  },
  {
    code: "LK_U",
    label: "LK/U Dataset",
    shortLabel: "HCFA",
    sourceCodes: ["LK_U"],
  },
  {
    code: "IMT_U",
    label: "IMT/U Dataset",
    shortLabel: "BMIFA",
    sourceCodes: ["IMT_U"],
  },
  {
    code: "LILA_U",
    label: "LiLA/U Dataset",
    shortLabel: "ACFA",
    sourceCodes: ["LILA_U"],
  },
];

export class SettingsService {
  private async appendConfigHistory(payload: {
    configId: "threshold" | "access";
    action: "update" | "reset";
    before: unknown;
    after: unknown;
    updatedBy?: string;
  }) {
    const historyConfigId = `config_history_${payload.configId}`;
    const existing = await prisma.systemConfig.findUnique({
      where: { id: historyConfigId },
    });

    const previousHistory =
      existing && Array.isArray(existing.value) ? existing.value : [];

    const nextHistory = [
      ...previousHistory,
      {
        at: new Date().toISOString(),
        action: payload.action,
        updatedBy: payload.updatedBy ?? null,
        before: payload.before,
        after: payload.after,
      },
    ].slice(-200);

    await prisma.systemConfig.upsert({
      where: { id: historyConfigId },
      create: {
        id: historyConfigId,
        value: nextHistory as Prisma.InputJsonValue,
        updatedBy: payload.updatedBy,
      },
      update: {
        value: nextHistory as Prisma.InputJsonValue,
        updatedBy: payload.updatedBy,
      },
    });
  }

  private async getOrCreateConfig(
    id: string,
    defaultValue: Prisma.InputJsonValue
  ) {
    const existing = await prisma.systemConfig.findUnique({ where: { id } });

    if (existing) {
      return existing;
    }

    return prisma.systemConfig.create({
      data: {
        id,
        value: defaultValue,
      },
    });
  }

  async getThresholdConfig() {
    const config = await this.getOrCreateConfig(
      "threshold",
      DEFAULT_THRESHOLD_CONFIG
    );

    return thresholdConfigSchema.parse(config.value);
  }

  async updateThresholdConfig(value: unknown, updatedBy?: string) {
    const parsedValue = thresholdConfigSchema.parse(value);
    const previous = await prisma.systemConfig.findUnique({
      where: { id: "threshold" },
    });

    const config = await prisma.systemConfig.upsert({
      where: { id: "threshold" },
      create: {
        id: "threshold",
        value: parsedValue,
        updatedBy,
      },
      update: {
        value: parsedValue,
        updatedBy,
      },
    });

    await this.appendConfigHistory({
      configId: "threshold",
      action: "update",
      before: previous?.value ?? null,
      after: parsedValue,
      updatedBy,
    });

    await auditService.log("settings.threshold.updated", {
      actor: updatedBy,
      target: "threshold",
      metadata: {
        minDataPoints: parsedValue.minDataPoints,
        warningEnabled: parsedValue.warningEnabled,
        falteringThreshold: parsedValue.falteringThreshold,
      },
    });

    return thresholdConfigSchema.parse(config.value);
  }

  async resetThresholdConfig(updatedBy?: string) {
    const previous = await prisma.systemConfig.findUnique({
      where: { id: "threshold" },
    });

    const config = await prisma.systemConfig.upsert({
      where: { id: "threshold" },
      create: {
        id: "threshold",
        value: DEFAULT_THRESHOLD_CONFIG as Prisma.InputJsonValue,
        updatedBy,
      },
      update: {
        value: DEFAULT_THRESHOLD_CONFIG as Prisma.InputJsonValue,
        updatedBy,
      },
    });

    await this.appendConfigHistory({
      configId: "threshold",
      action: "reset",
      before: previous?.value ?? null,
      after: DEFAULT_THRESHOLD_CONFIG,
      updatedBy,
    });

    await auditService.log("settings.threshold.reset", {
      actor: updatedBy,
      target: "threshold",
    });

    return thresholdConfigSchema.parse(config.value);
  }

  async getAccessConfig() {
    const config = await this.getOrCreateConfig(
      "access",
      DEFAULT_ACCESS_CONFIG
    );

    return accessConfigSchema.parse(config.value);
  }

  async updateAccessConfig(value: unknown, updatedBy?: string) {
    const parsedValue = accessConfigSchema.parse(value);
    const previous = await prisma.systemConfig.findUnique({
      where: { id: "access" },
    });

    const config = await prisma.systemConfig.upsert({
      where: { id: "access" },
      create: {
        id: "access",
        value: parsedValue,
        updatedBy,
      },
      update: {
        value: parsedValue,
        updatedBy,
      },
    });

    await this.appendConfigHistory({
      configId: "access",
      action: "update",
      before: previous?.value ?? null,
      after: parsedValue,
      updatedBy,
    });

    await auditService.log("settings.access.updated", {
      actor: updatedBy,
      target: "access",
      metadata: {
        sessionTimeout: parsedValue.sessionTimeout,
        multiDeviceLogin: parsedValue.multiDeviceLogin,
        emailVerification: parsedValue.emailVerification,
        auditLogging: parsedValue.auditLogging,
      },
    });

    return accessConfigSchema.parse(config.value);
  }

  private async getWhoDatasetsRaw(): Promise<WhoDatasetRow[]> {
    return prisma.whoDataset.findMany({
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
  }

  async getWhoDatasets(): Promise<WhoDatasetMappedResponse[]> {
    const datasets = await this.getWhoDatasetsRaw();

    return WHO_DATASET_DISPLAY_MAPPING.map((mapping) => {
      const candidates = datasets.filter((dataset) =>
        mapping.sourceCodes.includes(dataset.code)
      );

      const selected = candidates
        .toSorted(
          (left, right) =>
            right.lastUpdated.getTime() - left.lastUpdated.getTime()
        )
        .at(0);

      const fallbackDate = new Date("1970-01-01T00:00:00.000Z");

      return {
        code: mapping.code,
        label: mapping.label,
        shortLabel: mapping.shortLabel,
        description:
          selected?.description ??
          `Dataset referensi SD curve ${mapping.label.replace(" Dataset", "")}`,
        version: selected?.version ?? "-",
        lastUpdated: selected?.lastUpdated ?? fallbackDate,
        ageRange: selected?.ageRange ?? "0-60 bulan",
        isActive: selected?.isActive ?? false,
        sourceCodes: mapping.sourceCodes,
      };
    });
  }

  async getBootstrapStatus() {
    const [kbmRows, whoDatasets, kbmMetaConfig, whoMetaConfig] =
      await Promise.all([
        prisma.kbmReference.findMany({
          where: {
            usiaBulan: {
              gte: 0,
              lte: 60,
            },
          },
          select: { usiaBulan: true },
          orderBy: { usiaBulan: "asc" },
        }),
        this.getWhoDatasetsRaw(),
        prisma.systemConfig.findUnique({ where: { id: "kbm_dataset_meta" } }),
        prisma.systemConfig.findUnique({ where: { id: "who_dataset_meta" } }),
      ]);

    const kbmMeta =
      kbmMetaConfig && typeof kbmMetaConfig.value === "object"
        ? (kbmMetaConfig.value as { version?: string; lastUpdated?: string })
        : undefined;

    const existingMonths = new Set(kbmRows.map((item) => item.usiaBulan));
    const missingMonths = EXPECTED_KBM_MONTHS.filter(
      (month) => !existingMonths.has(month)
    );

    const expectedWhoCodesRaw =
      whoMetaConfig && typeof whoMetaConfig.value === "object"
        ? (whoMetaConfig.value as { expectedCodes?: unknown[] }).expectedCodes
        : [];

    const expectedWhoCodes = Array.isArray(expectedWhoCodesRaw)
      ? expectedWhoCodesRaw
          .filter((item): item is string => typeof item === "string")
          .sort((a, b) => a.localeCompare(b))
      : [];

    const existingWhoCodes = new Set(whoDatasets.map((item) => item.code));
    const missingWhoCodes = expectedWhoCodes.filter(
      (code) => !existingWhoCodes.has(code)
    );

    const kbmComplete = missingMonths.length === 0;
    const whoComplete =
      expectedWhoCodes.length > 0 && missingWhoCodes.length === 0;

    return {
      kbm: {
        expectedMonths: EXPECTED_KBM_MONTHS.length,
        totalRows: kbmRows.length,
        missingMonths,
        isComplete: kbmComplete,
        version: kbmMeta?.version ?? null,
        lastUpdated: kbmMeta?.lastUpdated ?? null,
      },
      whoDatasets: {
        expectedCodes: expectedWhoCodes,
        totalRows: whoDatasets.length,
        missingCodes: missingWhoCodes,
        isComplete: whoComplete,
        version:
          whoMetaConfig && typeof whoMetaConfig.value === "object"
            ? ((whoMetaConfig.value as { version?: string }).version ?? null)
            : null,
        lastUpdated:
          whoMetaConfig && typeof whoMetaConfig.value === "object"
            ? ((whoMetaConfig.value as { lastUpdated?: string }).lastUpdated ??
              null)
            : null,
      },
      isComplete: kbmComplete && whoComplete,
    };
  }

  async updateWhoDataset(id: number, data: UpdateWhoDatasetInput) {
    const existing = await prisma.whoDataset.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError("Dataset WHO tidak ditemukan");
    }

    return prisma.whoDataset.update({
      where: { id },
      data: {
        code: data.code,
        label: data.label,
        description: data.description,
        version: data.version,
        ageRange: data.ageRange,
        isActive: data.isActive,
        updatedBy: data.updatedBy,
        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : undefined,
      },
    });
  }
}

export const settingsService = new SettingsService();
