import { z } from "zod";

export const QUESTIONNAIRE_VERSION = 1;

// Schema for Sanitation Questionnaire (Example structure based on common needs, adjust as required)
export const SanitationQuestionnaireSchemaV1 = z.object({
  version: z.literal(1).optional().default(1),

  answers: z.record(z.string(), z.any()).refine((_data) => {
    // Basic validation: ensure keys exist. Specific questions can be validated here.
    // Example: required keys could be checked
    return true;
  }),
});

// Schema for Medical History Questionnaire
export const MedicalHistoryQuestionnaireSchemaV1 = z.object({
  version: z.literal(1).optional().default(1),

  answers: z.record(z.string(), z.any()).refine((_data) => {
    return true;
  }),
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
