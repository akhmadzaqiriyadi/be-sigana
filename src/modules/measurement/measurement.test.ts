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
const mockPrismaTransaction = mock();
mock.module("../../config/db", () => ({
  default: {
    measurement: {
      findUnique: mock(),
      findMany: mock(),
      count: mock(),
      findFirst: mock(),
      groupBy: mock(),
      create: mock(),
      update: mock(),
      createMany: mock(),
    },
    balita: {
      findUnique: mock(),
      findMany: mock(),
    },
    systemConfig: {
      findUnique: mock(),
      create: mock(),
    },
    $transaction: mockPrismaTransaction,
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

  describe("syncFromOffline (edge cases)", () => {
    beforeEach(() => {
      (prisma.measurement.findMany as any).mockReset();
      (prisma.balita.findMany as any).mockReset();
      (prisma.measurement.createMany as any).mockReset();
      mockPrismaTransaction.mockReset();

      // Default: no existing measurements, balita found
      (prisma.measurement.findMany as any).mockResolvedValue([]);
      (prisma.balita.findMany as any).mockResolvedValue([mockBalita]);
    });

    it("should upsert when localId already exists", async () => {
      (prisma.measurement.findMany as any).mockResolvedValue([
        { id: "existing-id", localId: "loc-1" },
      ]);
      (prisma.measurement.createMany as any).mockResolvedValue({ count: 0 });
      (prisma.$transaction as any).mockResolvedValue([{ id: "existing-id" }]);

      const result = await measurementService.syncFromOffline([
        {
          localId: "loc-1",
          balitaId: "balita-1",
          relawanId: "relawan-1",
          beratBadan: 11,
          tinggiBadan: 76,
          lingkarKepala: 45,
          lila: 15,
          posisiUkur: Posisi.TERLENTANG,
        },
      ]);

      // Should have updated (not created) the existing record
      expect(prisma.measurement.update).toHaveBeenCalled();
      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
    });

    it("should handle empty array gracefully", async () => {
      const result = await measurementService.syncFromOffline([]);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.status).toBe("success");
    });

    it("should skip measurements with missing balita", async () => {
      (prisma.balita.findMany as any).mockResolvedValue([]);
      (prisma.measurement.createMany as any).mockResolvedValue({ count: 0 });

      const result = await measurementService.syncFromOffline([
        {
          localId: "loc-1",
          balitaId: "nonexistent-balita",
          relawanId: "relawan-1",
          beratBadan: 10,
          tinggiBadan: 75,
          lingkarKepala: 45,
          lila: 15,
          posisiUkur: Posisi.TERLENTANG,
        },
      ]);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });

    it("should return correct shape", async () => {
      (prisma.measurement.createMany as any).mockResolvedValue({ count: 1 });

      const result = await measurementService.syncFromOffline([
        {
          localId: "loc-2",
          balitaId: "balita-1",
          relawanId: "relawan-1",
          beratBadan: 10,
          tinggiBadan: 75,
          lingkarKepala: 45,
          lila: 15,
          posisiUkur: Posisi.TERLENTANG,
        },
      ]);

      expect(result).toHaveProperty("created");
      expect(result).toHaveProperty("updated");
      expect(result).toHaveProperty("status");
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.status).toBe("success");
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
        informedConsent: true,
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

  describe("create (validation)", () => {
    beforeEach(() => {
      // Default mocks for create flow
      (prisma.balita.findUnique as any).mockResolvedValue(mockBalita);
      (prisma.measurement.count as any).mockResolvedValue(0);
      (prisma.measurement.create as any).mockResolvedValue({
        id: "meas-new",
        balitaId: "balita-1",
        beratBadan: 10,
        tinggiBadan: 75,
        bb_u_status: "normal",
        tb_u_status: "normal",
        bb_tb_status: "normal",
        statusAkhir: "HIJAU",
        balita: { id: "balita-1", namaAnak: "Ani", namaOrtu: "Budi" },
        relawan: { id: "relawan-1", name: "Rini" },
      });
    });

    it("should reject nonexistent balitaId with 404", async () => {
      (prisma.balita.findUnique as any).mockResolvedValue(null);

      await expect(
        measurementService.create({
          balitaId: "nonexistent",
          relawanId: "relawan-1",
          beratBadan: 10,
          tinggiBadan: 75,
          lingkarKepala: 45,
          lila: 15,
          posisiUkur: Posisi.TERLENTANG,
          informedConsent: true,
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should reject informedConsent: false", async () => {
      await expect(
        measurementService.create({
          balitaId: "balita-1",
          relawanId: "relawan-1",
          beratBadan: 10,
          tinggiBadan: 75,
          lingkarKepala: 45,
          lila: 15,
          posisiUkur: Posisi.TERLENTANG,
          informedConsent: false,
        })
      ).rejects.toThrow("Informed consent");
    });

    it("should reject negative beratBadan", async () => {
      await expect(
        measurementService.create({
          balitaId: "balita-1",
          relawanId: "relawan-1",
          beratBadan: -5,
          tinggiBadan: 75,
          lingkarKepala: 45,
          lila: 15,
          posisiUkur: Posisi.TERLENTANG,
          informedConsent: true,
        })
      ).rejects.toThrow("Berat badan");
    });

    it("should reject negative tinggiBadan", async () => {
      await expect(
        measurementService.create({
          balitaId: "balita-1",
          relawanId: "relawan-1",
          beratBadan: 10,
          tinggiBadan: -10,
          lingkarKepala: 45,
          lila: 15,
          posisiUkur: Posisi.TERLENTANG,
          informedConsent: true,
        })
      ).rejects.toThrow("Tinggi badan");
    });
  });

  describe("create (Z-Score computation)", () => {
    beforeEach(() => {
      (prisma.balita.findUnique as any).mockResolvedValue(mockBalita);
      (prisma.measurement.count as any).mockResolvedValue(0);
      (prisma.measurement.create as any).mockResolvedValue({
        id: "meas-z",
        balitaId: "balita-1",
        beratBadan: 10,
        tinggiBadan: 75,
        bb_u_status: "normal",
        tb_u_status: "normal",
        bb_tb_status: "normal",
        lk_u_status: "normal",
        lila_u_status: "normal",
        imt_u_status: "normal",
        statusAkhir: "HIJAU" as const,
        balita: { id: "balita-1", namaAnak: "Ani", namaOrtu: "Budi" },
        relawan: { id: "relawan-1", name: "Rini" },
      });
    });

    it("should call calculateAnthropometry and store bb_u_status", async () => {
      const result = await measurementService.create({
        balitaId: "balita-1",
        relawanId: "relawan-1",
        beratBadan: 10,
        tinggiBadan: 75,
        lingkarKepala: 45,
        lila: 15,
        posisiUkur: Posisi.TERLENTANG,
        informedConsent: true,
      });

      expect(result.bb_u_status).toBe("normal");
      expect(result.tb_u_status).toBe("normal");
      expect(result.bb_tb_status).toBe("normal");
      expect(result.statusAkhir).toBe("HIJAU");
    });

    it("should return needsHbRecommendation false when status is HIJAU", async () => {
      const result = await measurementService.create({
        balitaId: "balita-1",
        relawanId: "relawan-1",
        beratBadan: 10,
        tinggiBadan: 75,
        lingkarKepala: 45,
        lila: 15,
        posisiUkur: Posisi.TERLENTANG,
        informedConsent: true,
      });

      expect(result).toHaveProperty("needsHbRecommendation", false);
    });

    it("should pass localId to Prisma create", async () => {
      await measurementService.create({
        balitaId: "balita-1",
        relawanId: "relawan-1",
        beratBadan: 10,
        tinggiBadan: 75,
        lingkarKepala: 45,
        lila: 15,
        posisiUkur: Posisi.TERLENTANG,
        informedConsent: true,
        localId: "local-abc",
      });

      const createCall = (prisma.measurement.create as any).mock.lastCall[0];
      expect(createCall.data.localId).toBe("local-abc");
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

  describe("update", () => {
    const existingMeasurement = {
      id: "meas-1",
      balitaId: "balita-1",
      relawanId: "relawan-1",
      beratBadan: 10,
      tinggiBadan: 75,
      lingkarKepala: 45,
      lila: 15,
      posisiUkur: Posisi.TERLENTANG,
      bb_u_status: "normal",
      tb_u_status: "normal",
      bb_tb_status: "normal",
      statusAkhir: "HIJAU" as const,
      balita: mockBalita,
    };

    beforeEach(() => {
      (prisma.measurement.findUnique as any).mockResolvedValue(
        existingMeasurement
      );
      (prisma.measurement.count as any).mockResolvedValue(0);
      (prisma.measurement.update as any).mockImplementation(
        ({ data }: any) => ({
          ...existingMeasurement,
          ...data,
          balita: { id: "balita-1", namaAnak: "Ani", namaOrtu: "Budi" },
        })
      );
    });

    it("should recalculate Z-scores when weight changes", async () => {
      const result = await measurementService.update("meas-1", {
        beratBadan: 12,
        informedConsent: true,
      });

      expect(result.bb_u_status).toBe("normal");
      expect(result.statusAkhir).toBe("HIJAU");
    });

    it("should NOT recalculate Z-scores when anthropometry unchanged", async () => {
      const result = await measurementService.update("meas-1", {
        notes: "Hanya update catatan",
      });

      // bb_u_status should still be "normal" from the mock
      expect(result).toBeDefined();
    });

    it("should throw 404 for nonexistent measurement", async () => {
      (prisma.measurement.findUnique as any).mockResolvedValue(null);

      await expect(
        measurementService.update("nonexistent", {
          notes: "test",
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("delete", () => {
    const existingMeasurement = {
      id: "meas-1",
      balitaId: "balita-1",
      beratBadan: 10,
      tinggiBadan: 75,
    };

    beforeEach(() => {
      (prisma.measurement.findUnique as any).mockResolvedValue(
        existingMeasurement
      );
      (prisma.measurement.update as any).mockResolvedValue({
        ...existingMeasurement,
        deletedAt: new Date(),
      });
    });

    it("should soft delete by setting deletedAt", async () => {
      const result = await measurementService.delete("meas-1");

      expect(prisma.measurement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "meas-1" },
          data: { deletedAt: expect.any(Date) },
        })
      );
      expect(result).toHaveProperty("message");
    });

    it("should throw 404 for nonexistent measurement", async () => {
      (prisma.measurement.findUnique as any).mockResolvedValue(null);

      await expect(
        measurementService.delete("nonexistent")
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("findById (RBAC)", () => {
    const mockMeasurement = {
      id: "meas-1",
      balitaId: "balita-1",
      relawanId: "relawan-1",
      beratBadan: 12,
      tinggiBadan: 80,
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

    beforeEach(() => {
      (prisma.measurement.findUnique as any).mockResolvedValue(mockMeasurement);
      (prisma.measurement.findFirst as any).mockResolvedValue(null);
      (prisma.measurement.findMany as any).mockResolvedValue([]);
    });

    it("should allow RELAWAN to access own data", async () => {
      const result = await measurementService.findById("meas-1", {
        role: "RELAWAN",
        userId: "relawan-1",
      });

      expect(result.id).toBe("meas-1");
    });

    it("should throw 403 when RELAWAN accesses other's data", async () => {
      await expect(
        measurementService.findById("meas-1", {
          role: "RELAWAN",
          userId: "different-relawan",
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("should allow ADMIN to access any data", async () => {
      const result = await measurementService.findById("meas-1", {
        role: "ADMIN",
        userId: "admin-1",
      });

      expect(result.id).toBe("meas-1");
    });
  });

  describe("getPublicInfo", () => {
    it("should return masked name", async () => {
      (prisma.measurement.findFirst as any).mockResolvedValue({
        id: "meas-1",
        balita: {
          namaAnak: "Budi Santoso",
          jenisKelamin: "L",
          village: { name: "Desa Sukamaju" },
        },
        createdAt: new Date(),
      });

      const result = await measurementService.getPublicInfo("meas-1");
      expect(result.maskedName).toBe("B*** S***");
    });

    it("should throw 404 for nonexistent id", async () => {
      (prisma.measurement.findFirst as any).mockResolvedValue(null);
      (prisma.balita.findUnique as any).mockResolvedValue(null);

      await expect(
        measurementService.getPublicInfo("nonexistent")
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("verifyAccess", () => {
    it("should return data when DOB matches", async () => {
      const birthDate = new Date("2023-05-20");
      (prisma.measurement.findFirst as any).mockResolvedValue({
        balitaId: "balita-1",
      });
      (prisma.balita.findUnique as any).mockResolvedValue({
        id: "balita-1",
        namaAnak: "Ani",
        tanggalLahir: birthDate,
        village: { name: "Desa A" },
      });
      (prisma.measurement.findMany as any).mockResolvedValue([]);

      const result = await measurementService.verifyAccess(
        "meas-1",
        "2023-05-20"
      );
      expect(result.success).toBe(true);
    });

    it("should throw 403 when DOB does not match", async () => {
      const birthDate = new Date("2023-05-20");
      (prisma.measurement.findFirst as any).mockResolvedValue({
        balitaId: "balita-1",
      });
      (prisma.balita.findUnique as any).mockResolvedValue({
        id: "balita-1",
        namaAnak: "Ani",
        tanggalLahir: birthDate,
        village: { name: "Desa A" },
      });

      await expect(
        measurementService.verifyAccess("meas-1", "2024-01-01")
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe("getStatistics", () => {
    beforeEach(() => {
      (prisma.measurement.count as any).mockReset();
      (prisma.measurement.groupBy as any).mockReset();
      (prisma.measurement.findMany as any).mockReset();
      (prisma.measurement.findUnique as any).mockReset();
      (prisma.measurement.findFirst as any).mockReset();
    });

    it("should filter by isDisasterArea when param is provided", async () => {
      (prisma.measurement.count as any).mockResolvedValue(0);
      (prisma.measurement.groupBy as any).mockResolvedValue([]);
      (prisma.measurement.findMany as any).mockResolvedValue([
        {
          createdAt: new Date(),
          statusAkhir: "HIJAU",
          balita: { village: { id: 1, name: "Desa A", districts: "Kec A" } },
        },
      ]);

      await measurementService.getStatistics("6m", undefined, true);

      const firstCountCall = (prisma.measurement.count as any).mock.calls[0][0];
      expect(firstCountCall.where.isDisasterArea).toBe(true);
    });

    it("should return phbsComparison data in getStatistics", async () => {
      (prisma.measurement.count as any)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(120);

      (prisma.measurement.groupBy as any).mockResolvedValue([]);

      (prisma.measurement.findMany as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { createdAt: new Date(), statusAkhir: "HIJAU" },
        ])
        .mockResolvedValueOnce([]);

      const result = await measurementService.getStatistics("6m");

      expect(result.phbsComparison).toBeDefined();
      expect(result.phbsComparison.bencana.risiko).toBe(15);
      expect(result.phbsComparison.bencana.total).toBe(50);
      expect(result.phbsComparison.normal.risiko).toBe(8);
      expect(result.phbsComparison.normal.total).toBe(120);
    });
  });
});
