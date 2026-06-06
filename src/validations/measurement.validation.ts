import { z } from "zod";

export const imunisasiSchema = z.object({
  vaksin: z.string(),
  catatan: z.string().optional(),
});

export const clinicalExaminationSchema = z.object({
  tandaVital: z.object({
    suhuTubuh: z.string(),
    frekuensiNapas: z.string(),
  }),
  pemeriksaanFisik: z.object({
    kulit: z.object({ status: z.string(), keterangan: z.string() }),
    mata: z.object({ status: z.string(), keterangan: z.string() }),
    telinga: z.object({ status: z.string(), keterangan: z.string() }),
    jantung: z.object({ status: z.string(), keterangan: z.string() }),
    paru: z.object({ status: z.string(), keterangan: z.string() }),
  }),
  skriningBahaya: z.object({
    demamTinggi: z.object({ status: z.string(), keterangan: z.string() }),
    sesakNapas: z.object({ status: z.string(), keterangan: z.string() }),
    diareBerat: z.object({ status: z.string(), keterangan: z.string() }),
    kondisiLainnya: z.object({ status: z.string(), keterangan: z.string() }),
  }),
  tandaDefisiensi: z.array(z.string()),
});

export const nutritionalStatusSchema = z.object({
  riwayatPemberian: z.object({
    asiEksklusif: z.enum(["ASI_EKSKLUSIF", "TIDAK_ASI_EKSKLUSIF", "TIDAK_TAHU"]).nullable(),
    lamaAsiBulan: z.string(),
    usiaMulaiMpasi: z.string(),
  }),
  frekuensiMakanan: z.object({
    makanUtama: z.string(),
    makananSelingan: z.string(),
    makanTeratur: z.enum(["YA", "TIDAK"]).nullable(),
    masihAsi: z.enum(["YA", "TIDAK"]).nullable(),
    tidakMakanSaatSakit: z.enum(["YA", "TIDAK"]).nullable(),
  }),
  kualitasMakanan: z.object({
    sayur: z.enum(["Ya", "Tidak"]).nullable(),
    buah: z.enum(["Ya", "Tidak"]).nullable(),
    proteinHewani: z.enum(["Ya", "Tidak"]).nullable(),
    proteinNabati: z.enum(["Ya", "Tidak"]).nullable(),
    makananPokok: z.enum(["Ya", "Tidak"]).nullable(),
    lemak: z.enum(["Ya", "Tidak"]).nullable(),
  }),
});

export const sanitasiV2Schema = z.object({
  conditions: z.array(z.string()),
});

const v2Fields = {
  imunisasiData: imunisasiSchema.optional(),
  klinikData: clinicalExaminationSchema.optional(),
  giziData: nutritionalStatusSchema.optional(),
  sanitasiData: sanitasiV2Schema.optional(),
};

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
    ...v2Fields,
  }),
});

const v2FieldsArray = {
  imunisasiData: imunisasiSchema.optional(),
  klinikData: clinicalExaminationSchema.optional(),
  giziData: nutritionalStatusSchema.optional(),
  sanitasiData: sanitasiV2Schema.optional(),
};

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
        ...v2FieldsArray,
      })
    ),
  }),
});

export const getMeasurementSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    search: z.string().optional(),
    balitaId: z.string().uuid().optional(),
    status: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().optional()
    ),
    timeRange: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.enum(["all", "today", "7_days", "30_days", "this_month"]).optional()
    ),
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

export const updateMeasurementSchema = z.object({
  body: z.object({
    beratBadan: z.number().positive("Berat badan harus positif").optional(),
    tinggiBadan: z.number().positive("Tinggi badan harus positif").optional(),
    lingkarKepala: z.number().positive().optional(),
    lila: z.number().positive().optional(),
    posisiUkur: z.enum(["TERLENTANG", "BERDIRI"]).optional(),
    notes: z.string().optional(),
    ...v2Fields,
  }),
});
