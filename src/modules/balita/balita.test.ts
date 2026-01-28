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
    },
    posko: {
      findUnique: mock(),
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
    poskoId: 1,
  };

  beforeEach(() => {
    mock.restore();
  });

  describe("create", () => {
    it("should create a balita", async () => {
      (prisma.village.findUnique as any).mockResolvedValue({ id: 1 });
      (prisma.posko.findUnique as any).mockResolvedValue({ id: 1 });
      (prisma.balita.create as any).mockResolvedValue(mockBalita);

      const result = await balitaService.create({
        namaAnak: "Budi",
        namaOrtu: "Siti",
        tanggalLahir: new Date("2024-01-01"),
        jenisKelamin: "L",
        villageId: 1,
        poskoId: 1,
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
      (prisma.balita.findMany as any).mockResolvedValue([mockBalita]);
      (prisma.balita.count as any).mockResolvedValue(1);

      const result = await balitaService.findAll(1, 10);
      expect(result.balitas).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
