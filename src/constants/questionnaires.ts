import { z } from "zod";

export const QUESTIONNAIRE_VERSION = 1;

// Define the exact keys the frontend should send
export const SANITATION_QUESTIONS = [
  { id: "mpasi", text: "Mendapat MPASI", type: "boolean" },
  { id: "ventilasi", text: "Ventilasi udara baik", type: "boolean" },
  { id: "air_bersih", text: "Akses air bersih", type: "boolean" },
  { id: "jamban", text: "Jamban sehat", type: "boolean" },
  { id: "sampah", text: "Pembuangan sampah tertutup", type: "boolean" },
  { id: "asap_rokok", text: "Bebas asap rokok", type: "boolean" },
] as const;

export const MEDICAL_HISTORY_QUESTIONS = [
  { id: "demam", category: "ksi", text: "Demam", type: "boolean" },
  { id: "diare", category: "ksi", text: "Diare", type: "boolean" },
  { id: "batuk", category: "ksi", text: "Batuk", type: "boolean" },
  {
    id: "masalah_kulit",
    category: "ksi",
    text: "Masalah Kulit",
    type: "boolean",
  },
  {
    id: "general_health",
    category: "general",
    text: "Kondisi Umum (1-10)",
    type: "number",
  },
  {
    id: "nafsu_makan",
    category: "general",
    text: "Nafsu Makan (1-10)",
    type: "number",
  },
  {
    id: "riwayat_penyakit_lain",
    category: "general",
    text: "Riwayat Penyakit Lain",
    type: "text",
  },
] as const;

// Helper to extract IDs for validation
export const SanitationIds = SANITATION_QUESTIONS.map((q) => q.id) as [
  string,
  ...string[],
];
export const MedicalHistoryIds = MEDICAL_HISTORY_QUESTIONS.map((q) => q.id) as [
  string,
  ...string[],
];

// Schema for Sanitation Questionnaire
// Allow any keys but we could strictly validate against SanitationIds if desired in future
export const SanitationQuestionnaireSchemaV1 = z.object({
  version: z.literal(1).optional().default(1),
  answers: z
    .object({
      mpasi: z.boolean().optional(),
      ventilasi: z.boolean().optional(),
      air_bersih: z.boolean().optional(),
      jamban: z.boolean().optional(),
      sampah: z.boolean().optional(),
      asap_rokok: z.boolean().optional(),
    })
    .passthrough(),
});

// Schema for Medical History Questionnaire
export const MedicalHistoryQuestionnaireSchemaV1 = z.object({
  version: z.literal(1).optional().default(1),
  answers: z
    .object({
      demam: z.boolean().optional(),
      diare: z.boolean().optional(),
      batuk: z.boolean().optional(),
      masalah_kulit: z.boolean().optional(),
      general_health: z.number().optional(),
      nafsu_makan: z.number().optional(),
      riwayat_penyakit_lain: z.string().optional(),
    })
    .passthrough(),
});

export const validateQuestionnaireResponse = (
  type: "sanitation" | "medicalHistory",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
) => {
  if (!data) return null;

  // Handle versioning logic here if multiple versions exist in future
  const version = data.version || 1;

  if (version === 1) {
    if (type === "sanitation") {
      return SanitationQuestionnaireSchemaV1.safeParse(data);
    } else {
      return MedicalHistoryQuestionnaireSchemaV1.safeParse(data);
    }
  }

  return {
    success: false,
    error: { message: `Unsupported version: ${version}` },
  };
};
