import { z } from 'zod';

export const createMeasurementSchema = z.object({
  body: z.object({
    balitaId: z.string().uuid('ID Balita tidak valid'),
    beratBadan: z.number().positive('Berat badan harus positif'),
    tinggiBadan: z.number().positive('Tinggi badan harus positif'),
    lingkarKepala: z.number().positive().optional(),
    lila: z.number().positive().optional(),
    posisiUkur: z.enum(['TERLENTANG', 'BERDIRI']),
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
        posisiUkur: z.enum(['TERLENTANG', 'BERDIRI']),
        recordedAt: z.string().optional(),
      })
    ),
  }),
});

export const getMeasurementSchema = z.object({
  query: z.object({
    balitaId: z.string().uuid().optional(),
    status: z.enum(['HIJAU', 'KUNING', 'MERAH']).optional(),
  }),
});
