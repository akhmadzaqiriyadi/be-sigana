import { z } from "zod";

export const createMeasurementSchema = z.object({
  body: z.object({
    balitaId: z.string().uuid("ID Balita tidak valid"),
    beratBadan: z.number().positive("Berat badan harus positif"),
    tinggiBadan: z.number().positive("Tinggi badan harus positif"),
    lingkarKepala: z.number().positive().optional(),
    lila: z.number().positive().optional(),
    posisiUkur: z.enum(["TERLENTANG", "BERDIRI"]),
    // Optional status fields (Offline First support) - Validation only
    bb_u_status: z.string().optional(),
    tb_u_status: z.string().optional(),
    bb_tb_status: z.string().optional(),
    statusAkhir: z.enum(["HIJAU", "KUNING", "MERAH"]).optional(),
  }),
});

export const syncMeasurementSchema = z.object({
  body: z.object({
    measurements: z.array(
      z.object({
        localId: z.string().optional(),
        balitaId: z.string().uuid(),
        beratBadan: z.number().positive(),
        tinggiBadan: z.number().positive(),
        lingkarKepala: z.number().optional(),
        lila: z.number().optional(),
        posisiUkur: z.enum(["TERLENTANG", "BERDIRI"]),
        recordedAt: z.string().optional(),
        // Optional status fields (Offline First support)
        bb_u_status: z.string().optional(),
        tb_u_status: z.string().optional(),
        bb_tb_status: z.string().optional(),
        statusAkhir: z.enum(["HIJAU", "KUNING", "MERAH"]).optional(),
      })
    ),
  }),
});

export const getMeasurementSchema = z.object({
  query: z.object({
    balitaId: z.string().uuid().optional(),
    status: z.enum(["HIJAU", "KUNING", "MERAH"]).optional(),
    updatedAfter: z
      .string()
      .datetime({ message: "Format tanggal harus ISO 8601" })
      .optional(),
    createdAfter: z
      .string()
      .datetime({ message: "Format tanggal harus ISO 8601" })
      .optional(),
  }),
});

export const syncPullSchema = z.object({
  query: z.object({
    lastSync: z.string().datetime("Format tanggal harus ISO 8601"),
  }),
});

export const accessMeasurementSchema = z.object({
  body: z.object({
    dob: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir harus YYYY-MM-DD"),
  }),
});
