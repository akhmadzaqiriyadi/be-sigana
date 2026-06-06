import { describe, expect, it, mock, beforeEach } from "bun:test";
import {
  measurementService,
  SyncMeasurementInput,
} from "./measurement.service";
import prisma from "@/config/db";
import { Posisi } from "@prisma/client";

// Mock Z-score calculator to avoid WHO data dependency
mock.module("../../utils/zscore/calculator", () => ({
  calculateAnthropometry: () => ({
    bb_u_status: "normal",
    tb_u_status: "normal",
    bb_tb_status: "normal",
    lk_u_status: "normal",
    lila_u_status: "normal",
    imt_u_status: "normal",
    statusAkhir: "HIJAU",
    zScores: { bb_u: 0, tb_u: 0, bb_tb: 0, lk_u: 0, lila_u: 0, imt_u: 0 },
  }),
}));

// Mock prisma and Standards
mock.module("../../config/db", () => ({
  default: {
    measurement: {
      findUnique: mock(),
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
    systemConfig: {
      findUnique: mock(),
      create: mock(),
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
    // Re-setup threshold config via systemConfig mock (used by settingsService.getThresholdConfig)
    ((prisma as any).systemConfig.findUnique as any).mockResolvedValue({
      id: "threshold",
      value: {
        minDataPoints: 3,
        warningEnabled: true,
        falteringThreshold: 2,
        badgeColors: {
          normal: "#22c55e",
          warning: "#eab308",
          faltering: "#f97316",
          giziBuruk: "#ef4444",
        },
      },
    });
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

  describe("create with V2 payload", () => {
    it("should store V2 imunisasiData, klinikData, giziData, sanitasiData", async () => {
      (prisma.balita.findUnique as any).mockResolvedValue(mockBalita);
      (prisma.measurement.count as any).mockResolvedValue(0);
      (prisma.measurement.create as any).mockResolvedValue({
        id: "meas-1",
        balitaId: "balita-1",
        beratBadan: 10,
        tinggiBadan: 75,
        imunisasiData: { vaksin: "BCG", catatan: "lengkap" },
        klinikData: {
          tandaVital: { suhuTubuh: "36.5", frekuensiNapas: "30" },
          pemeriksaanFisik: {
            kulit: { status: "normal", keterangan: "bersih" },
            mata: { status: "normal", keterangan: "jernih" },
            telinga: { status: "normal", keterangan: "bersih" },
            jantung: { status: "normal", keterangan: "teratur" },
            paru: { status: "normal", keterangan: "vesikuler" },
          },
          skriningBahaya: {
            demamTinggi: { status: "tidak", keterangan: "tidak ada" },
            sesakNapas: { status: "tidak", keterangan: "tidak ada" },
            diareBerat: { status: "tidak", keterangan: "tidak ada" },
            kondisiLainnya: { status: "tidak", keterangan: "tidak ada" },
          },
          tandaDefisiensi: [],
        },
        giziData: {
          riwayatPemberian: {
            asiEksklusif: "ASI_EKSKLUSIF",
            lamaAsiBulan: "6",
            usiaMulaiMpasi: "6",
          },
          frekuensiMakanan: {
            makanUtama: "3",
            makananSelingan: "2",
            makanTeratur: "YA",
            masihAsi: "TIDAK",
            tidakMakanSaatSakit: "TIDAK",
          },
          kualitasMakanan: {
            sayur: "Ya",
            buah: "Ya",
            proteinHewani: "Ya",
            proteinNabati: "Ya",
            makananPokok: "Ya",
            lemak: "Ya",
          },
        },
        sanitationData: { conditions: ["ventilasi", "air_bersih"] },
      });

      const _result = await measurementService.create({
        balitaId: "balita-1",
        relawanId: "relawan-1",
        beratBadan: 10,
        tinggiBadan: 75,
        lingkarKepala: 45,
        lila: 15,
        posisiUkur: Posisi.TERLENTANG,
        imunisasiData: { vaksin: "BCG", catatan: "lengkap" },
        klinikData: {
          tandaVital: { suhuTubuh: "36.5", frekuensiNapas: "30" },
          pemeriksaanFisik: {
            kulit: { status: "normal", keterangan: "bersih" },
            mata: { status: "normal", keterangan: "jernih" },
            telinga: { status: "normal", keterangan: "bersih" },
            jantung: { status: "normal", keterangan: "teratur" },
            paru: { status: "normal", keterangan: "vesikuler" },
          },
          skriningBahaya: {
            demamTinggi: { status: "tidak", keterangan: "tidak ada" },
            sesakNapas: { status: "tidak", keterangan: "tidak ada" },
            diareBerat: { status: "tidak", keterangan: "tidak ada" },
            kondisiLainnya: { status: "tidak", keterangan: "tidak ada" },
          },
          tandaDefisiensi: [],
        },
        giziData: {
          riwayatPemberian: {
            asiEksklusif: "ASI_EKSKLUSIF",
            lamaAsiBulan: "6",
            usiaMulaiMpasi: "6",
          },
          frekuensiMakanan: {
            makanUtama: "3",
            makananSelingan: "2",
            makanTeratur: "YA",
            masihAsi: "TIDAK",
            tidakMakanSaatSakit: "TIDAK",
          },
          kualitasMakanan: {
            sayur: "Ya",
            buah: "Ya",
            proteinHewani: "Ya",
            proteinNabati: "Ya",
            makananPokok: "Ya",
            lemak: "Ya",
          },
        },
        sanitationData: { conditions: ["ventilasi", "air_bersih"] },
      });

      const createCall = (prisma.measurement.create as any).mock.lastCall[0];
      expect(createCall.data.imunisasiData).toEqual({
        vaksin: "BCG",
        catatan: "lengkap",
      });
      expect(createCall.data.klinikData.tandaVital.suhuTubuh).toBe("36.5");
      expect(createCall.data.giziData.riwayatPemberian.asiEksklusif).toBe(
        "ASI_EKSKLUSIF"
      );
      expect(createCall.data.sanitationData).toEqual({
        conditions: ["ventilasi", "air_bersih"],
      });
    });
  });

  describe("findById with V2 fields", () => {
    const mockCurrentMeasurement = {
      id: "meas-2",
      balitaId: "balita-1",
      relawanId: "relawan-1",
      beratBadan: 12,
      tinggiBadan: 80,
      lingkarKepala: 46,
      lila: 16,
      posisiUkur: Posisi.TERLENTANG,
      bb_u_status: "normal",
      tb_u_status: "normal",
      bb_tb_status: "normal",
      statusAkhir: "HIJAU" as const,
      balita: {
        id: "balita-1",
        namaAnak: "Ani",
        namaOrtu: "Budi",
        tanggalLahir: new Date(new Date().setMonth(new Date().getMonth() - 12)),
        jenisKelamin: "P",
        village: { id: 1, name: "Desa A", districts: "Kec A" },
      },
      relawan: { id: "relawan-1", name: "Rini", email: "rini@test.com" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should return deltaBB when previous measurement exists", async () => {
      (prisma.measurement.findUnique as any).mockResolvedValue(
        mockCurrentMeasurement
      );
      (prisma.measurement.findFirst as any).mockResolvedValue({
        beratBadan: 10,
        createdAt: new Date(),
      });
      (prisma.measurement.findMany as any).mockResolvedValue([
        { beratBadan: 10, tinggiBadan: 75, createdAt: new Date() },
        { beratBadan: 12, tinggiBadan: 80, createdAt: new Date() },
      ]);

      const result = await measurementService.findById("meas-2");
      expect(result.deltaBB).toBe(2);
    });

    it("should return null deltaBB when no previous measurement", async () => {
      (prisma.measurement.findUnique as any).mockResolvedValue(
        mockCurrentMeasurement
      );
      (prisma.measurement.findFirst as any).mockResolvedValue(null);
      (prisma.measurement.findMany as any).mockResolvedValue([
        { beratBadan: 12, tinggiBadan: 80, createdAt: new Date() },
      ]);

      const result = await measurementService.findById("meas-2");
      expect(result.deltaBB).toBeNull();
    });

    it("should return growthHistory array", async () => {
      (prisma.measurement.findUnique as any).mockResolvedValue(
        mockCurrentMeasurement
      );
      (prisma.measurement.findFirst as any).mockResolvedValue(null);
      (prisma.measurement.findMany as any).mockResolvedValue([
        { beratBadan: 10, tinggiBadan: 75, createdAt: new Date() },
        { beratBadan: 12, tinggiBadan: 80, createdAt: new Date() },
      ]);

      const result = await measurementService.findById("meas-2");
      expect(Array.isArray(result.growthHistory)).toBe(true);
      expect(result.growthHistory.length).toBe(2);
      expect(result.growthHistory[0]).toHaveProperty("age");
      expect(result.growthHistory[0]).toHaveProperty("weight");
      expect(result.growthHistory[0]).toHaveProperty("height");
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
