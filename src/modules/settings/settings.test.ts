import { beforeEach, describe, expect, it, mock } from "bun:test";
import prisma from "@/config/db";
import { settingsService } from "./settings.service";

mock.module("@/config/db", () => ({
  default: {
    systemConfig: {
      findUnique: mock(),
      create: mock(),
      upsert: mock(),
    },
    kbmReference: {
      findMany: mock(),
    },
    whoDataset: {
      findMany: mock(),
      findUnique: mock(),
      update: mock(),
    },
  },
}));

describe("SettingsService", () => {
  beforeEach(() => {
    const mocks = [
      prisma.systemConfig.findUnique,
      prisma.systemConfig.create,
      prisma.systemConfig.upsert,
      prisma.kbmReference.findMany,
      prisma.whoDataset.findMany,
      prisma.whoDataset.findUnique,
      prisma.whoDataset.update,
    ];

    mocks.forEach((fn: any) => fn.mockClear?.());
  });

  it("should create and return default threshold config when missing", async () => {
    const defaultConfig = {
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

    (prisma.systemConfig.findUnique as any).mockResolvedValue(null);
    (prisma.systemConfig.create as any).mockResolvedValue({
      id: "threshold",
      value: defaultConfig,
    });

    const result = await settingsService.getThresholdConfig();

    expect(result).toEqual(defaultConfig);
    expect(prisma.systemConfig.create).toHaveBeenCalledWith({
      data: {
        id: "threshold",
        value: defaultConfig,
      },
    });
  });

  it("should upsert access config with updatedBy", async () => {
    const accessConfig = {
      auditLogging: true,
      sessionTimeout: 60,
      multiDeviceLogin: false,
      emailVerification: true,
    };

    (prisma.systemConfig.upsert as any).mockResolvedValue({
      id: "access",
      value: accessConfig,
    });

    const result = await settingsService.updateAccessConfig(
      accessConfig,
      "admin@sigana.id"
    );

    expect(result).toEqual(accessConfig);
    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
      where: { id: "access" },
      create: {
        id: "access",
        value: accessConfig,
        updatedBy: "admin@sigana.id",
      },
      update: {
        value: accessConfig,
        updatedBy: "admin@sigana.id",
      },
    });

    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "config_history_access" },
      })
    );
  });

  it("should return mapped WHO datasets for frontend cards", async () => {
    const datasets = [
      {
        id: 1,
        code: "BB_U",
        label: "Berat Badan menurut Umur",
        description: "Dataset BB/U",
        version: "v2.1.0",
        lastUpdated: new Date("2025-06-01T00:00:00.000Z"),
        ageRange: "0-60 bulan",
        isActive: true,
        updatedAt: new Date("2026-03-16T00:00:00.000Z"),
        updatedBy: null,
      },
      {
        id: 2,
        code: "TB_U",
        label: "Tinggi Badan menurut Umur",
        description: "Dataset TB/U",
        version: "v2.1.0",
        lastUpdated: new Date("2025-06-01T00:00:00.000Z"),
        ageRange: "0-60 bulan",
        isActive: true,
        updatedAt: new Date("2026-03-16T00:00:00.000Z"),
        updatedBy: null,
      },
      {
        id: 3,
        code: "BB_PB",
        label: "Berat Badan menurut Panjang Badan",
        description: "Dataset BB/PB",
        version: "v2.1.0",
        lastUpdated: new Date("2025-06-01T00:00:00.000Z"),
        ageRange: "0-60 bulan",
        isActive: true,
        updatedAt: new Date("2026-03-16T00:00:00.000Z"),
        updatedBy: null,
      },
      {
        id: 4,
        code: "LK_U",
        label: "Lingkar Kepala menurut Umur",
        description: "Dataset LK/U",
        version: "v2.0.0",
        lastUpdated: new Date("2025-03-15T00:00:00.000Z"),
        ageRange: "0-60 bulan",
        isActive: true,
        updatedAt: new Date("2026-03-16T00:00:00.000Z"),
        updatedBy: null,
      },
      {
        id: 5,
        code: "IMT_U",
        label: "IMT menurut Umur",
        description: "Dataset IMT/U",
        version: "v2.0.0",
        lastUpdated: new Date("2025-03-15T00:00:00.000Z"),
        ageRange: "0-60 bulan",
        isActive: true,
        updatedAt: new Date("2026-03-16T00:00:00.000Z"),
        updatedBy: null,
      },
      {
        id: 6,
        code: "LILA_U",
        label: "Lingkar Lengan Atas menurut Umur",
        description: "Dataset LiLA/U",
        version: "v1.5.0",
        lastUpdated: new Date("2025-01-20T00:00:00.000Z"),
        ageRange: "0-60 bulan",
        isActive: true,
        updatedAt: new Date("2026-03-16T00:00:00.000Z"),
        updatedBy: null,
      },
    ];

    (prisma.whoDataset.findMany as any).mockResolvedValue(datasets);

    const result = await settingsService.getWhoDatasets();

    expect(result).toHaveLength(6);
    expect(result[0]).toMatchObject({
      code: "BB_U",
      label: "BB/U Dataset",
      shortLabel: "WFA",
      version: "v2.1.0",
    });
    expect(result[1]).toMatchObject({
      code: "PB_U",
      label: "PB/U atau TB/U Dataset",
      shortLabel: "LFA/HFA",
      sourceCodes: ["PB_U", "TB_U"],
    });
    expect(result[2]).toMatchObject({
      code: "BB_TB",
      label: "BB/TB atau BB/PB Dataset",
      shortLabel: "WFL/WFH",
      sourceCodes: ["BB_TB", "BB_PB"],
    });
    expect(result[3]).toMatchObject({
      code: "LK_U",
      shortLabel: "HCFA",
    });
    expect(result[4]).toMatchObject({
      code: "IMT_U",
      shortLabel: "BMIFA",
    });
    expect(result[5]).toMatchObject({
      code: "LILA_U",
      shortLabel: "ACFA",
    });
    expect(prisma.whoDataset.findMany).toHaveBeenCalledWith({
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
  });

  it("should throw NotFoundError when WHO dataset does not exist", async () => {
    (prisma.whoDataset.findUnique as any).mockResolvedValue(null);

    let error: any;
    try {
      await settingsService.updateWhoDataset(123, {
        version: "WHO 2007",
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeDefined();
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain("Dataset WHO tidak ditemukan");
  });

  it("should convert lastUpdated to Date when updating WHO dataset", async () => {
    (prisma.whoDataset.findUnique as any).mockResolvedValue({ id: 10 });
    (prisma.whoDataset.update as any).mockResolvedValue({
      id: 10,
      code: "BB_U",
      version: "WHO 2006",
    });

    await settingsService.updateWhoDataset(10, {
      version: "WHO 2006",
      lastUpdated: "2026-03-16T00:00:00.000Z",
      updatedBy: "admin@sigana.id",
    });

    expect(prisma.whoDataset.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        version: "WHO 2006",
        updatedBy: "admin@sigana.id",
        lastUpdated: new Date("2026-03-16T00:00:00.000Z"),
      }),
    });
  });

  it("should reset threshold config to server defaults", async () => {
    const defaultConfig = {
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

    (prisma.systemConfig.upsert as any).mockResolvedValue({
      id: "threshold",
      value: defaultConfig,
    });

    const result =
      await settingsService.resetThresholdConfig("admin@sigana.id");

    expect(result).toEqual(defaultConfig);
    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
      where: { id: "threshold" },
      create: expect.objectContaining({
        id: "threshold",
        value: defaultConfig,
        updatedBy: "admin@sigana.id",
      }),
      update: expect.objectContaining({
        value: defaultConfig,
        updatedBy: "admin@sigana.id",
      }),
    });
  });

  it("should return complete bootstrap status when KBM and WHO defaults are present", async () => {
    const months = Array.from({ length: 61 }, (_, usiaBulan) => ({
      usiaBulan,
    }));
    const expectedCodes = ["BB_U", "PB_U", "BB_TB", "LK_U", "IMT_U", "LILA_U"];
    const whoDatasets = expectedCodes.map((code, index) => ({
      id: index + 1,
      code,
      isActive: true,
    }));

    (prisma.systemConfig.findUnique as any).mockResolvedValue({
      id: "who_dataset_meta",
      value: {
        expectedCodes,
      },
    });
    (prisma.kbmReference.findMany as any).mockResolvedValue(months);
    (prisma.whoDataset.findMany as any).mockResolvedValue(whoDatasets);

    const result = await settingsService.getBootstrapStatus();

    expect(result.isComplete).toBe(true);
    expect(result.kbm.totalRows).toBe(61);
    expect(result.kbm.missingMonths).toEqual([]);
    expect(result.whoDatasets.totalRows).toBe(6);
    expect(result.whoDatasets.missingCodes).toEqual([]);
  });
});
