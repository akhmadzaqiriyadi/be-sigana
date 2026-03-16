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

const growthMeasureCsvSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0)
  )
  .refine(
    (items) =>
      items.every((item) =>
        ["bb_u", "tb_u", "bb_tb", "lk_u", "lila_u", "imt_u"].includes(item)
      ),
    {
      message:
        "Query measures hanya boleh berisi bb_u,tb_u,bb_tb,lk_u,lila_u,imt_u",
    }
  );

const growthSexCsvSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0)
  )
  .refine((items) => items.every((item) => ["L", "P"].includes(item)), {
    message: "Query sex hanya boleh berisi L,P",
  });

export const growthDatasetsQuerySchema = z.object({
  query: z.object({
    measures: growthMeasureCsvSchema.optional(),
    sex: growthSexCsvSchema.optional(),
  }),
});

const classificationBandSchema = z.object({
  label: z.string().min(1, "Label band wajib diisi"),
  minInclusive: z.number().optional(),
  minExclusive: z.number().optional(),
  maxInclusive: z.number().optional(),
  maxExclusive: z.number().optional(),
});

const classificationRuleSchema = z.object({
  outlierAbs: z.number().int().positive("outlierAbs harus positif"),
  bands: z
    .array(classificationBandSchema)
    .min(1, "Minimal 1 band per indikator"),
});

export const classificationRulesBodySchema = z.object({
  bb_u: classificationRuleSchema.optional(),
  tb_u: classificationRuleSchema.optional(),
  bb_tb: classificationRuleSchema.optional(),
  lk_u: classificationRuleSchema.optional(),
  lila_u: classificationRuleSchema.optional(),
  imt_u: classificationRuleSchema.optional(),
});

export const updateGrowthClassificationRulesSchema = z.object({
  body: classificationRulesBodySchema.refine(
    (body) => Object.values(body).some((v) => v !== undefined),
    { message: "Minimal satu indikator harus diisi" }
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

export const changeOwnPasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
    newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
  }),
});

export const adminResetPasswordSchema = z.object({
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
  body: z.object({
    newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
  }),
});

export const updateUserStatusSchema = z.object({
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
  body: z.object({
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DELETED"]),
  }),
});

const bulkUserIdsSchema = z
  .array(
    z
      .string()
      .refine(
        (value) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value
          ),
        "ID User tidak valid"
      )
  )
  .min(1, "Minimal 1 pengguna")
  .max(200, "Maksimal 200 pengguna per aksi bulk");

export const bulkVerifyUsersSchema = z.object({
  body: z.object({
    userIds: bulkUserIdsSchema,
  }),
});

export const bulkDeleteUsersSchema = z.object({
  body: z.object({
    userIds: bulkUserIdsSchema,
  }),
});

export const bulkUpdateRoleSchema = z.object({
  body: z.object({
    userIds: bulkUserIdsSchema,
    role: z.enum(["ADMIN", "RELAWAN", "STAKEHOLDER"]),
  }),
});
