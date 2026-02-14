import { describe, expect, it, mock, beforeEach } from "bun:test";
import {
  measurementService,
  SyncMeasurementInput,
} from "./measurement.service";
import prisma from "@/config/db";
import { Posisi } from "@prisma/client";

// Mock prisma and Standards
mock.module("../../config/db", () => ({
  default: {
    measurement: {
      findMany: mock(),
      count: mock(),
      findFirst: mock(),
      create: mock(),
      update: mock(),
      createMany: mock(),
      $transaction: mock(),
    },
    balita: {
      findUnique: mock(),
      findMany: mock(),
    },
  },
}));

// We can mock the calculator utility if we want purely unit test Service logic,
// OR we let it run (integration style for logic) since it's a utility.
// Let's rely on the real utility for Z-Score correctness as it was just tested.

describe("MeasurementService", () => {
  const mockBalita = {
    id: "balita-1",
    tanggalLahir: new Date(new Date().setMonth(new Date().getMonth() - 12)), // 1 year old
    jenisKelamin: "L",
  };

  beforeEach(() => {
    mock.restore();
  });

  describe("findAll (RBAC)", () => {
    it("should filter by relawanId if user is RELAWAN", async () => {
      (prisma.measurement.findMany as any).mockResolvedValue([]);
      (prisma.measurement.count as any).mockResolvedValue(0);

      await measurementService.findAll(
        1,
        10,
        {},
        { role: "RELAWAN", userId: "relawan-1" }
      );

      const callArgs = (prisma.measurement.findMany as any).mock.lastCall[0];
      expect(callArgs.where.relawanId).toBe("relawan-1");
    });

    it("should NOT force filter for ADMIN", async () => {
      (prisma.measurement.findMany as any).mockResolvedValue([]);
      (prisma.measurement.count as any).mockResolvedValue(0);

      await measurementService.findAll(
        1,
        10,
        {},
        { role: "ADMIN", userId: "admin-1" }
      );

      const callArgs = (prisma.measurement.findMany as any).mock.lastCall[0];
      // Should be undefined unless explicitly passed in filters
      expect(callArgs.where.relawanId).toBeUndefined();
    });
  });

  describe("syncFromOffline", () => {
    it("should batch process measurements", async () => {
      const payload: SyncMeasurementInput[] = [
        {
          localId: "loc-1",
          balitaId: "balita-1",
          relawanId: "relawan-1",
          beratBadan: 10,
          tinggiBadan: 75,
          lingkarKepala: 45,
          lila: 15,
          posisiUkur: Posisi.TERLENTANG,
        },
      ];

      // Mock findings
      (prisma.measurement.findMany as any).mockResolvedValue([]); // No existing
      (prisma.balita.findMany as any).mockResolvedValue([mockBalita]);
      (prisma.measurement.createMany as any).mockResolvedValue({ count: 1 });

      const result = await measurementService.syncFromOffline(payload);

      expect(prisma.measurement.createMany).toHaveBeenCalled();
      expect(result.created).toBe(1);
    });
  });

  describe("findAll (Date Filters)", () => {
    it("should pass updatedAfter filter as { gt } condition", async () => {
      (prisma.measurement.findMany as any).mockResolvedValue([]);
      (prisma.measurement.count as any).mockResolvedValue(0);

      const filterDate = new Date("2024-06-01T00:00:00Z");

      await measurementService.findAll(
        1,
        10,
        { updatedAfter: filterDate },
        { role: "ADMIN", userId: "admin-1" }
      );

      const callArgs = (prisma.measurement.findMany as any).mock.lastCall[0];
      expect(callArgs.where.updatedAt).toEqual({ gt: filterDate });
    });

    it("should pass createdAfter filter as { gt } condition", async () => {
      (prisma.measurement.findMany as any).mockResolvedValue([]);
      (prisma.measurement.count as any).mockResolvedValue(0);

      const filterDate = new Date("2024-01-01T00:00:00Z");

      await measurementService.findAll(
        1,
        10,
        { createdAfter: filterDate },
        { role: "ADMIN", userId: "admin-1" }
      );

      const callArgs = (prisma.measurement.findMany as any).mock.lastCall[0];
      expect(callArgs.where.createdAt).toEqual({ gt: filterDate });
    });

    it("should combine date filters with other filters", async () => {
      (prisma.measurement.findMany as any).mockResolvedValue([]);
      (prisma.measurement.count as any).mockResolvedValue(0);

      const updatedDate = new Date("2024-06-01T00:00:00Z");
      const createdDate = new Date("2024-01-01T00:00:00Z");

      await measurementService.findAll(
        1,
        10,
        {
          balitaId: "balita-1",
          updatedAfter: updatedDate,
          createdAfter: createdDate,
        },
        { role: "ADMIN", userId: "admin-1" }
      );

      const callArgs = (prisma.measurement.findMany as any).mock.lastCall[0];
      expect(callArgs.where.balitaId).toBe("balita-1");
      expect(callArgs.where.updatedAt).toEqual({ gt: updatedDate });
      expect(callArgs.where.createdAt).toEqual({ gt: createdDate });
    });
  });

  describe("getDeltaSync", () => {
    it("should query for records updated or deleted after lastSync", async () => {
      (prisma.measurement.findMany as any).mockResolvedValue([]);

      const lastSync = new Date("2024-06-01T00:00:00Z");

      await measurementService.getDeltaSync(lastSync);

      const callArgs = (prisma.measurement.findMany as any).mock.lastCall[0];
      expect(callArgs.where.OR).toEqual([
        { updatedAt: { gt: lastSync } },
        { deletedAt: { gt: lastSync } },
      ]);
    });

    it("should scope to relawanId when provided", async () => {
      (prisma.measurement.findMany as any).mockResolvedValue([]);

      const lastSync = new Date("2024-06-01T00:00:00Z");

      await measurementService.getDeltaSync(lastSync, "relawan-1");

      const callArgs = (prisma.measurement.findMany as any).mock.lastCall[0];
      expect(callArgs.where.relawanId).toBe("relawan-1");
    });

    it("should select essential sync fields including tombstones", async () => {
      (prisma.measurement.findMany as any).mockResolvedValue([]);

      const lastSync = new Date("2024-06-01T00:00:00Z");

      await measurementService.getDeltaSync(lastSync);

      const callArgs = (prisma.measurement.findMany as any).mock.lastCall[0];
      expect(callArgs.select).toHaveProperty("localId", true);
      expect(callArgs.select).toHaveProperty("deletedAt", true);
      expect(callArgs.select).toHaveProperty("updatedAt", true);
      expect(callArgs.select).toHaveProperty("balitaId", true);
    });
  });
});
