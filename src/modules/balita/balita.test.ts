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
    mock.restore();
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
      expect(result).toHaveProperty("umurBulan");
      expect(prisma.balita.create).toHaveBeenCalled();
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
  });
});
