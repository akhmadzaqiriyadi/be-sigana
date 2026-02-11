import { z } from "zod";

export const createVillageSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Nama desa minimal 3 karakter"),
    districts: z.string().min(3, "Nama kecamatan minimal 3 karakter"),
  }),
});

export const createPoskoSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Nama posko minimal 3 karakter"),
    villageId: z.number().int(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
});

export const createBalitaSchema = z.object({
  body: z.object({
    namaAnak: z.string().min(1, "Nama anak wajib diisi"),
    namaOrtu: z.string().min(1, "Nama orang tua wajib diisi"),
    tanggalLahir: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Format tanggal tidak valid (YYYY-MM-DD)",
    }),
    jenisKelamin: z.enum(["L", "P"]),
    villageId: z.number().int(),
    poskoId: z.number().optional(), // Fixed from string.uuid() to match DB Schema Int
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
        poskoId: z.number().optional().nullable(),
        createdAt: z.string().optional(),
      })
    ),
  }),
});

export const verifyUserSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID User tidak valid"),
  }),
});
