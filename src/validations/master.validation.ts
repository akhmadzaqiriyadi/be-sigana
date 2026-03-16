import { z } from "zod";

const villageBodySchema = z.object({
  name: z.string().min(3, "Nama desa minimal 3 karakter").optional(),
  districts: z.string().min(3, "Nama kecamatan minimal 3 karakter").optional(),
  latitude: z
    .number()
    .refine(Number.isFinite, "Latitude harus berupa angka yang valid")
    .optional(),
  longitude: z
    .number()
    .refine(Number.isFinite, "Longitude harus berupa angka yang valid")
    .optional(),
  isActive: z.boolean().optional(),
});

export const createVillageSchema = z.object({
  body: villageBodySchema.extend({
    name: z.string().min(3, "Nama desa minimal 3 karakter"),
    districts: z.string().min(3, "Nama kecamatan minimal 3 karakter"),
  }),
});

export const updateVillageSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive("ID desa tidak valid"),
  }),
  body: villageBodySchema.refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    {
      message: "Minimal satu field harus diisi",
    }
  ),
});

export const updateKbmReferenceSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive("ID KBM tidak valid"),
  }),
  body: z.object({
    kbmMinimal: z.number().int().min(0, "Nilai KBM minimal tidak valid"),
  }),
});

const hexColorSchema = z
  .string()
  .regex(
    /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/,
    "Warna harus berformat hex valid (#RGB, #RRGGBB, atau #RRGGBBAA)"
  );

export const thresholdConfigSchema = z.object({
  minDataPoints: z.number().int().min(1, "Minimal data point harus >= 1"),
  warningEnabled: z.boolean(),
  falteringThreshold: z.number().int().min(1, "Faltering threshold harus >= 1"),
  badgeColors: z.object({
    normal: hexColorSchema,
    warning: hexColorSchema,
    faltering: hexColorSchema,
    giziBuruk: hexColorSchema,
  }),
});

export const updateThresholdConfigSchema = z.object({
  body: thresholdConfigSchema,
});

export const accessConfigSchema = z.object({
  auditLogging: z.boolean(),
  sessionTimeout: z
    .number()
    .int()
    .refine((value) => [15, 30, 60, 120].includes(value), {
      message: "Session timeout harus salah satu dari 15, 30, 60, 120",
    }),
  multiDeviceLogin: z.boolean(),
  emailVerification: z.boolean(),
});

export const updateAccessConfigSchema = z.object({
  body: accessConfigSchema,
});

export const updateWhoDatasetSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive("ID dataset tidak valid"),
  }),
  body: z
    .object({
      code: z.string().min(3).optional(),
      label: z.string().min(3).optional(),
      description: z.string().min(3).optional(),
      version: z.string().min(1).optional(),
      lastUpdated: z
        .string()
        .refine(
          (value) => !Number.isNaN(Date.parse(value)),
          "Tanggal update dataset tidak valid"
        )
        .optional(),
      ageRange: z.string().min(3).optional(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (body) => Object.values(body).some((value) => value !== undefined),
      {
        message: "Minimal satu field harus diisi",
      }
    ),
});

export const createBalitaSchema = z.object({
  body: z.object({
    namaAnak: z.string().min(1, "Nama anak wajib diisi"),
    namaOrtu: z.string().min(1, "Nama orang tua wajib diisi"),
    tanggalLahir: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
      message: "Format tanggal tidak valid (YYYY-MM-DD)",
    }),
    jenisKelamin: z.enum(["L", "P"]),
    villageId: z.number().int(),
  }),
});

export const syncBalitaSchema = z.object({
  body: z.object({
    balitas: z.array(
      z.object({
        localId: z.string(),
        namaAnak: z.string().min(1, "Nama anak wajib diisi"),
        namaOrtu: z.string().min(1, "Nama orang tua wajib diisi"),
        tanggalLahir: z.string().or(z.date()),
        jenisKelamin: z.enum(["L", "P"]),
        villageId: z.number().int(),
        createdAt: z.string().optional(),
      })
    ),
  }),
});

export const verifyUserSchema = z.object({
  params: z.object({
    id: z
      .string()
      .refine(
        (value) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value
          ),
        "ID User tidak valid"
      ),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
    newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
  }),
});
