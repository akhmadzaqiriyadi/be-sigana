import { beforeEach, describe, expect, it, mock } from "bun:test";
import prisma from "@/config/db";

const mockAuditLog = mock();
const mockGetThresholdConfig = mock();
const mockDatasets = [
  {
    measure: "bb_u" as const,
    sex: "L" as const,
    referenceType: "month" as const,
    rows: [{ referenceValue: 0, L: -0.3521, M: 3.3464, S: 0.14602 }],
  },
  {
    measure: "bb_u" as const,
    sex: "P" as const,
    referenceType: "month" as const,
    rows: [{ referenceValue: 0, L: -0.3833, M: 3.2322, S: 0.14171 }],
  },
  {
    measure: "tb_u" as const,
    sex: "L" as const,
    referenceType: "month" as const,
    rows: [{ referenceValue: 0, L: 1, M: 49.8842, S: 0.03795 }],
  },
];

mock.module("@/config/db", () => ({
  default: {
    systemConfig: {
      findUnique: mock(),
      upsert: mock(),
      deleteMany: mock(),
    },
    whoDataset: {
      findMany: mock(),
    },
  },
}));

mock.module("@/modules/audit/audit.service", () => ({
  auditService: {
    log: mockAuditLog,
  },
}));

mock.module("@/modules/settings/settings.service", () => ({
  settingsService: {
    getThresholdConfig: mockGetThresholdConfig,
  },
}));

mock.module("@/utils/zscore/standards", () => ({
  WHO_STANDARDS: mockDatasets.map((ds) => ({
    measure: ds.measure,
    sex: ds.sex,
    data: ds.rows.map((r) => ({
      month: r.referenceValue,
      L: r.L,
      M: r.M,
      S: r.S,
    })),
  })),
}));

import { growthService } from "./growth.service";

const DEFAULT_THRESHOLD = {
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

describe("GrowthService", () => {
  beforeEach(() => {
    [
      prisma.systemConfig.findUnique,
      prisma.systemConfig.upsert,
      prisma.systemConfig.deleteMany,
      prisma.whoDataset.findMany,
      mockAuditLog,
      mockGetThresholdConfig,
    ].forEach((fn: any) => fn.mockClear?.());

    (mockGetThresholdConfig as any).mockResolvedValue(DEFAULT_THRESHOLD);
    (prisma.systemConfig.findUnique as any).mockResolvedValue(null);
    (prisma.whoDataset.findMany as any).mockResolvedValue([]);
  });

  // ─── Classification Rules ──────────────────────────────────────────────────

  describe("getClassificationRulesPublic", () => {
    it("should return default rules when no DB override exists", async () => {
      (prisma.systemConfig.findUnique as any).mockResolvedValue(null);

      const rules = await growthService.getClassificationRulesPublic();

      expect(rules).toHaveProperty("bb_u");
      expect(rules).toHaveProperty("tb_u");
      expect(rules).toHaveProperty("bb_tb");
      expect(rules).toHaveProperty("lk_u");
      expect(rules).toHaveProperty("lila_u");
      expect(rules).toHaveProperty("imt_u");
      expect(rules.bb_u.outlierAbs).toBe(5);
      expect(Array.isArray(rules.bb_u.bands)).toBe(true);
    });

    it("should merge DB override with defaults when partial override exists", async () => {
      const overrideBbU = {
        outlierAbs: 6,
        bands: [{ label: "Custom Band", maxExclusive: -4 }],
      };

      (prisma.systemConfig.findUnique as any).mockResolvedValue({
        id: "growth_classification_rules",
        value: { bb_u: overrideBbU },
        updatedAt: new Date("2026-01-01"),
        updatedBy: "admin@test.id",
      });

      const rules = await growthService.getClassificationRulesPublic();

      expect(rules.bb_u).toEqual(overrideBbU);
      // other measures remain as default
      expect(rules.tb_u.outlierAbs).toBe(5);
    });
  });

  // ─── Update Classification Rules ──────────────────────────────────────────

  describe("updateClassificationRules", () => {
    it("should merge new values over current rules and upsert to DB", async () => {
      const newBbU = {
        outlierAbs: 6,
        bands: [{ label: "Updated Band", maxExclusive: -3 }],
      };

      (prisma.systemConfig.findUnique as any).mockResolvedValue(null);
      (prisma.systemConfig.upsert as any).mockResolvedValue({
        id: "growth_classification_rules",
        value: {},
        updatedAt: new Date(),
        updatedBy: "admin@test.id",
      });
      mockAuditLog.mockResolvedValue(undefined);

      const result = await growthService.updateClassificationRules(
        { bb_u: newBbU },
        "admin@test.id"
      );

      expect(result.bb_u).toEqual(newBbU);
      // non-updated measures fall back to defaults
      expect(result.tb_u.outlierAbs).toBe(5);

      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "growth_classification_rules" },
        })
      );
    });

    it("should call audit log after update", async () => {
      (prisma.systemConfig.findUnique as any).mockResolvedValue(null);
      (prisma.systemConfig.upsert as any).mockResolvedValue({
        id: "growth_classification_rules",
        value: {},
        updatedAt: new Date(),
        updatedBy: "admin",
      });
      mockAuditLog.mockResolvedValue(undefined);

      await growthService.updateClassificationRules(
        { lk_u: { outlierAbs: 4, bands: [] } },
        "admin@test.id"
      );

      expect(mockAuditLog).toHaveBeenCalledWith(
        "growth.classification_rules.updated",
        expect.objectContaining({ actor: "admin@test.id" })
      );
    });
  });

  // ─── Reset Classification Rules ───────────────────────────────────────────

  describe("resetClassificationRules", () => {
    it("should call deleteMany and return default classification rules", async () => {
      (prisma.systemConfig.deleteMany as any).mockResolvedValue({ count: 1 });
      mockAuditLog.mockResolvedValue(undefined);

      const result =
        await growthService.resetClassificationRules("admin@test.id");

      expect(prisma.systemConfig.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "growth_classification_rules" },
        })
      );

      expect(result).toHaveProperty("bb_u");
      expect(result).toHaveProperty("tb_u");
      expect(result).toHaveProperty("bb_tb");
      expect(result).toHaveProperty("lk_u");
      expect(result).toHaveProperty("lila_u");
      expect(result).toHaveProperty("imt_u");
      expect(result.bb_u.outlierAbs).toBe(5);
    });

    it("should call audit log after reset", async () => {
      (prisma.systemConfig.deleteMany as any).mockResolvedValue({ count: 1 });
      mockAuditLog.mockResolvedValue(undefined);

      await growthService.resetClassificationRules("admin@test.id");

      expect(mockAuditLog).toHaveBeenCalledWith(
        "growth.classification_rules.reset",
        expect.objectContaining({ actor: "admin@test.id" })
      );
    });
  });

  // ─── getVersionInfo ────────────────────────────────────────────────────────

  describe("getVersionInfo", () => {
    it("should return version string starting with growth-config-", async () => {
      const versionInfo = await growthService.getVersionInfo();

      expect(versionInfo.version).toMatch(/^growth-config-[0-9a-f]{16}$/);
    });

    it("should return etag in W/ format", async () => {
      const versionInfo = await growthService.getVersionInfo();

      expect(versionInfo.etag).toMatch(/^W\/"growth-config-[0-9a-f]{16}"$/);
    });

    it("should return lastModified as a Date instance", async () => {
      const versionInfo = await growthService.getVersionInfo();

      expect(versionInfo.lastModified).toBeInstanceOf(Date);
    });

    it("should return generatedAt ISO string", async () => {
      const versionInfo = await growthService.getVersionInfo();

      const parsed = new Date(versionInfo.generatedAt);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
    });
  });

  // ─── getBootstrap ──────────────────────────────────────────────────────────

  describe("getBootstrap", () => {
    it("should return threshold from settingsService", async () => {
      const bootstrap = await growthService.getBootstrap();

      expect(bootstrap.threshold).toEqual(DEFAULT_THRESHOLD);
    });

    it("should return classification rules with all 6 measures", async () => {
      const bootstrap = await growthService.getBootstrap();

      const keys = Object.keys(bootstrap.classificationRules);
      expect(keys).toContain("bb_u");
      expect(keys).toContain("tb_u");
      expect(keys).toContain("bb_tb");
      expect(keys).toContain("lk_u");
      expect(keys).toContain("lila_u");
      expect(keys).toContain("imt_u");
    });

    it("should return datasetMeta with all 6 measures", async () => {
      const bootstrap = await growthService.getBootstrap();

      const keys = Object.keys(bootstrap.datasetMeta);
      expect(keys).toContain("bb_u");
      expect(keys).toContain("tb_u");
      expect(keys).toContain("bb_tb");
      expect(keys).toContain("lk_u");
      expect(keys).toContain("lila_u");
      expect(keys).toContain("imt_u");
    });

    it("should return a valid version hash", async () => {
      const bootstrap = await growthService.getBootstrap();

      expect(bootstrap.version).toMatch(/^growth-config-[0-9a-f]{16}$/);
    });
  });

  // ─── getDatasets ───────────────────────────────────────────────────────────

  describe("getDatasets", () => {
    it("should return all datasets when no filters applied", async () => {
      const result = await growthService.getDatasets({});

      // mockDatasets has 3 rows: bb_u/L, bb_u/P, tb_u/L
      expect(result.datasets.length).toBe(3);
    });

    it("should filter datasets by measure", async () => {
      const result = await growthService.getDatasets({ measures: ["bb_u"] });

      expect(result.datasets.every((d) => d.measure === "bb_u")).toBe(true);
      expect(result.datasets.length).toBe(2);
    });

    it("should filter datasets by sex", async () => {
      const result = await growthService.getDatasets({ sexes: ["L"] });

      expect(result.datasets.every((d) => d.sex === "L")).toBe(true);
      expect(result.datasets.length).toBe(2);
    });

    it("should filter by both measure and sex", async () => {
      const result = await growthService.getDatasets({
        measures: ["bb_u"],
        sexes: ["P"],
      });

      expect(result.datasets.length).toBe(1);
      expect(result.datasets[0].measure).toBe("bb_u");
      expect(result.datasets[0].sex).toBe("P");
    });

    it("should return version string in payload", async () => {
      const result = await growthService.getDatasets({});

      expect(result.version).toMatch(/^who-lms-[0-9a-f]{16}$/);
    });
  });
});
