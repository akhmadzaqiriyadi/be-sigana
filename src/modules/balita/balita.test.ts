import { describe, expect, it, mock, beforeEach } from "bun:test";
import { balitaService } from "./balita.service";
import prisma from "@/config/db";

// Mock prisma
mock.module("../../config/db", () => ({
  default: {
    balita: {
      findUnique: mock(),
      findMany: mock(),
      count: mock(),
      create: mock(),
      update: mock(),
      delete: mock(),
      findFirst: mock(),
    },
    village: {
      findUnique: mock(),
      findMany: mock(),
    },
  },
}));

describe("BalitaService", () => {
  const mockBalita = {
    id: "balita-1",
    namaAnak: "Budi",
    namaOrtu: "Siti",
    tanggalLahir: new Date("2024-01-01"),
    jenisKelamin: "L",
    villageId: 1,
  };

  const mockBalitaWithLatestMeasurement = {
    ...mockBalita,
    village: {
      id: 1,
      name: "Desa Maju",
      districts: "Kecamatan Sehat",
      latitude: null,
      longitude: null,
    },
    measurements: [
      {
        id: "m-1",
        beratBadan: 7.5,
        tinggiBadan: 67,
        lila: 13,
        statusAkhir: "HIJAU",
        bb_tb_status: "Gizi Baik",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        relawan: {
          name: "Relawan A",
        },
      },
    ],
  };

  beforeEach(() => {
    (
      [
        "findUnique",
        "findMany",
        "count",
        "create",
        "update",
        "delete",
        "findFirst",
      ] as const
    ).forEach((m) => ((prisma.balita as any)[m] as any).mockReset());
    (["findUnique", "findMany"] as const).forEach((m) =>
      ((prisma.village as any)[m] as any).mockReset()
    );
  });

  describe("create", () => {
    it("should create a balita", async () => {
      (prisma.village.findUnique as any).mockResolvedValue({ id: 1 });
      (prisma.balita.create as any).mockResolvedValue(mockBalita);

      const result = await balitaService.create({
        namaAnak: "Budi",
        namaOrtu: "Siti",
        tanggalLahir: new Date("2024-01-01"),
        jenisKelamin: "L",
        villageId: 1,
      });

      expect(result.id).toEqual(mockBalita.id);
      expect(result.umurBulan).toBeGreaterThan(0);
      expect(prisma.balita.create).toHaveBeenCalled();
    });

    it("should throw NotFoundError if village not found", async () => {
      (prisma.village.findUnique as any).mockResolvedValue(null);

      try {
        await balitaService.create({
          namaAnak: "Budi",
          namaOrtu: "Siti",
          tanggalLahir: new Date("2024-01-01"),
          jenisKelamin: "L",
          villageId: 999,
        });
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
      }
    });
  });

  describe("update", () => {
    it("should update a balita", async () => {
      (prisma.balita.findUnique as any).mockResolvedValue(mockBalita);
      (prisma.balita.update as any).mockResolvedValue({
        ...mockBalita,
        namaAnak: "Budi Updated",
      });

      const result = await balitaService.update("balita-1", {
        namaAnak: "Budi Updated",
      });
      expect(result.id).toEqual(mockBalita.id);
      expect(prisma.balita.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "balita-1" },
          data: { namaAnak: "Budi Updated" },
        })
      );
    });

    it("should throw NotFoundError if balita not found", async () => {
      (prisma.balita.findUnique as any).mockResolvedValue(null);

      try {
        await balitaService.update("balita-99", { namaAnak: "Budi Updated" });
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
      }
    });
  });

  describe("delete", () => {
    it("should delete a balita", async () => {
      (prisma.balita.findUnique as any).mockResolvedValue(mockBalita);
      (prisma.balita.delete as any).mockResolvedValue(mockBalita);

      const result = await balitaService.delete("balita-1");
      expect(result).toHaveProperty("message");
      expect(prisma.balita.delete).toHaveBeenCalledWith({
        where: { id: "balita-1" },
      });
    });

    it("should throw NotFoundError if balita not found", async () => {
      (prisma.balita.findUnique as any).mockResolvedValue(null);

      try {
        await balitaService.delete("balita-99");
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
      }
    });
  });

  describe("findById", () => {
    it("should return balita if found", async () => {
      (prisma.balita.findUnique as any).mockResolvedValue(mockBalita);

      const result = await balitaService.findById("balita-1");
      expect(result.id).toEqual(mockBalita.id);
      expect(result).toHaveProperty("umurBulan");
    });

    it("should throw NotFoundError if not found", async () => {
      (prisma.balita.findUnique as any).mockResolvedValue(null);

      try {
        await balitaService.findById("balita-99");
      } catch (error: any) {
        expect(error).toHaveProperty("statusCode", 404);
        expect(error).toHaveProperty("message");
      }
    });

    it("should return balita with measurements and umurBulan", async () => {
      (prisma.balita.findUnique as any).mockResolvedValue(
        mockBalitaWithLatestMeasurement
      );

      const result = await balitaService.findById("balita-1");
      expect(result.id).toEqual(mockBalita.id);
      expect(result).toHaveProperty("umurBulan");
      expect(result).toHaveProperty("village");
      expect(result).toHaveProperty("measurements");
      expect(result.measurements).toHaveLength(1);
    });
  });

  describe("findAll", () => {
    it("should return paginated results", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([
        mockBalitaWithLatestMeasurement,
      ]);
      (prisma.balita.count as any)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await balitaService.findAll(1, 10);
      expect(result.balitas).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.summary.totalTerdata).toBe(1);
    });

    // ponytail: repeated 6× count mock per findAll filter test; helper if test count grows
    it("should filter by search query", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([
        mockBalitaWithLatestMeasurement,
      ]);
      (prisma.balita.count as any)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await balitaService.findAll(1, 10, { search: "Budi" });
      expect(result.balitas).toHaveLength(1);

      const firstCallArgs = (prisma.balita.findMany as any).mock.calls[0][0];
      expect(firstCallArgs.where.OR[0]).toEqual({
        namaAnak: { contains: "Budi", mode: "insensitive" },
      });
    });

    it("should filter by villageId", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([]);
      (prisma.balita.count as any)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await balitaService.findAll(1, 10, { villageId: 1 });
      const firstCallArgs = (prisma.balita.findMany as any).mock.calls[0][0];
      expect(firstCallArgs.where.villageId).toBe(1);
    });

    it("should filter by statusGizi normal", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([]);
      (prisma.balita.count as any)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await balitaService.findAll(1, 10, { statusGizi: "normal" });
      const firstCallArgs = (prisma.balita.findMany as any).mock.calls[0][0];
      expect(firstCallArgs.where.measurements.some.statusAkhir).toBe("HIJAU");
    });

    it("should filter by statusGizi faltering", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([]);
      (prisma.balita.count as any)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await balitaService.findAll(1, 10, { statusGizi: "faltering" });
      const firstCallArgs = (prisma.balita.findMany as any).mock.calls[0][0];
      expect(firstCallArgs.where.measurements.some.statusAkhir).toBe("MERAH");
      expect(firstCallArgs.where.measurements.some.bb_tb_status).toEqual({
        not: { contains: "Buruk" },
      });
    });

    it("should filter by statusGizi gizi buruk", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([]);
      (prisma.balita.count as any)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await balitaService.findAll(1, 10, { statusGizi: "gizi buruk" });
      const firstCallArgs = (prisma.balita.findMany as any).mock.calls[0][0];
      expect(firstCallArgs.where.measurements.some.statusAkhir).toBe("MERAH");
      expect(firstCallArgs.where.measurements.some.bb_tb_status).toEqual({
        contains: "Buruk",
      });
    });

    it("should filter by period 6_months", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([]);
      (prisma.balita.count as any)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await balitaService.findAll(1, 10, { period: "6_months" });
      const firstCallArgs = (prisma.balita.findMany as any).mock.calls[0][0];
      expect(firstCallArgs.where.measurements.some.createdAt.gte).toBeDefined();
    });

    it("should filter by isLilaRendah", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([]);
      (prisma.balita.count as any)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await balitaService.findAll(1, 10, { isLilaRendah: true });
      const firstCallArgs = (prisma.balita.findMany as any).mock.calls[0][0];
      expect(firstCallArgs.where.measurements.some.lila).toEqual({ lt: 11.5 });
    });

    it("should filter by isSanitasiBuruk", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([]);
      (prisma.balita.count as any)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await balitaService.findAll(1, 10, { isSanitasiBuruk: true });
      const firstCallArgs = (prisma.balita.findMany as any).mock.calls[0][0];
      expect(firstCallArgs.where.measurements.some.sanitationData.path).toEqual(
        ["isSanitasiBuruk"]
      );
    });
  });

  describe("getSummary", () => {
    it("should return summary and byVillage data", async () => {
      (prisma.balita.count as any)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      (prisma.village.findMany as any).mockResolvedValue([
        { id: 1, name: "Desa Maju" },
      ]);

      const result = await balitaService.getSummary({
        period: "6_months",
        includeByVillage: true,
      });

      expect(result.summary.totalTerdata).toBe(10);
      expect(result.summary.normal).toBe(6);
      expect(result.byVillage).toHaveLength(1);
      expect(result.byVillage[0]).toEqual({
        villageId: 1,
        namaVillage: "Desa Maju",
        totalTerdata: 5,
        normal: 3,
        warning: 1,
        faltering: 1,
        giziBuruk: 0,
      });
      expect(result.period).toBe("6_months");
    });

    it("should skip byVillage when includeByVillage is false", async () => {
      (prisma.village.findMany as any).mockClear();

      (prisma.balita.count as any)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      const result = await balitaService.getSummary({
        includeByVillage: false,
      });

      expect(result.summary.totalTerdata).toBe(4);
      expect(result.byVillage).toHaveLength(0);
      expect(prisma.village.findMany).not.toHaveBeenCalled();
    });

    it("should filter summary by villageId and period", async () => {
      (prisma.balita.count as any)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.village.findMany as any).mockResolvedValue([
        { id: 2, name: "Desa Sejahtera" },
      ]);

      const result = await balitaService.getSummary({
        villageId: 2,
        period: "3_months",
      });

      expect(result.summary.totalTerdata).toBe(5);
      expect(result.byVillage).toHaveLength(1);
      expect(result.byVillage[0].villageId).toBe(2);
      expect(result.period).toBe("3_months");
    });
  });

  describe("sync", () => {
    const syncInput = [
      {
        localId: "local-1",
        namaAnak: "Ani",
        namaOrtu: "Budi",
        tanggalLahir: new Date("2024-06-01"),
        jenisKelamin: "P",
        villageId: 1,
      },
    ];

    it("should create new balita", async () => {
      (prisma.village.findUnique as any).mockResolvedValue({ id: 1 });
      (prisma.balita.findFirst as any).mockResolvedValue(null);
      (prisma.balita.create as any).mockResolvedValue({
        id: "server-1",
        ...syncInput[0],
      });

      const result = await balitaService.sync(syncInput);
      expect(result[0].status).toBe("created");
      expect(result[0].serverId).toBe("server-1");
    });

    it("should merge duplicate balita", async () => {
      (prisma.village.findUnique as any).mockResolvedValue({ id: 1 });
      (prisma.balita.findFirst as any).mockResolvedValue({
        id: "existing-1",
      });

      const result = await balitaService.sync(syncInput);
      expect(result[0].status).toBe("merged");
      expect(result[0].serverId).toBe("existing-1");
    });

    it("should fail if village not found", async () => {
      (prisma.village.findUnique as any).mockResolvedValue(null);

      const result = await balitaService.sync(syncInput);
      expect(result[0].status).toBe("failed");
      expect(result[0].error).toBeDefined();
    });

    // ponytail: tests one-item-per-scenario; batch race conditions not covered
    it("should handle multiple items and return array", async () => {
      const multiInput = [
        {
          localId: "local-1",
          namaAnak: "Ani",
          namaOrtu: "Budi",
          tanggalLahir: new Date("2024-06-01"),
          jenisKelamin: "P",
          villageId: 1,
        },
        {
          localId: "local-2",
          namaAnak: "Cici",
          namaOrtu: "Dedi",
          tanggalLahir: new Date("2024-07-01"),
          jenisKelamin: "P",
          villageId: 1,
        },
      ];

      (prisma.village.findUnique as any).mockResolvedValue({ id: 1 });
      (prisma.balita.findFirst as any).mockResolvedValue(null);
      (prisma.balita.create as any)
        .mockResolvedValueOnce({ id: "server-1", ...multiInput[0] })
        .mockResolvedValueOnce({ id: "server-2", ...multiInput[1] });

      const result = await balitaService.sync(multiInput);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("created");
      expect(result[1].status).toBe("created");
    });
  });
});
