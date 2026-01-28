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
});
