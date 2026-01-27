export interface LMSRecord {
  month: number;
  L: number;
  M: number;
  S: number;
}

export interface GrowthStandard {
  sex: "L" | "P";
  measure: "bb_u" | "tb_u" | "bb_tb";
  data: LMSRecord[];
}

// NOTE: In a production environment, these tables should be populated with the full WHO dataset (0-60 months).
// For this implementation, we provide key checkpoints. The calculator should use linear interpolation between months.

export const WHO_STANDARDS: GrowthStandard[] = [
  // --- BB/U (Weight for Age) BOYS ---
  {
    sex: "L",
    measure: "bb_u",
    data: [
      { month: 0, L: 0.1815, M: 3.3464, S: 0.12745 },
      { month: 1, L: 0.136, M: 4.4709, S: 0.12643 },
      { month: 6, L: 0.0435, M: 7.9392, S: 0.11438 },
      { month: 12, L: 0.0324, M: 9.648, S: 0.11181 },
      { month: 24, L: 0.0381, M: 12.152, S: 0.11654 },
      { month: 36, L: 0.0416, M: 14.341, S: 0.12297 },
      { month: 48, L: 0.0454, M: 16.326, S: 0.12921 },
      { month: 60, L: 0.0496, M: 18.258, S: 0.13488 },
    ],
  },
  // --- BB/U (Weight for Age) GIRLS ---
  {
    sex: "P",
    measure: "bb_u",
    data: [
      { month: 0, L: 0.1548, M: 3.2325, S: 0.1367 },
      { month: 6, L: 0.0322, M: 7.297, S: 0.12217 },
      { month: 12, L: 0.0211, M: 8.951, S: 0.12 },
      { month: 24, L: 0.0263, M: 11.482, S: 0.1252 },
      { month: 60, L: 0.0374, M: 18.204, S: 0.14785 },
    ],
  },
  // --- TB/U (Height for Age) BOYS ---
  {
    sex: "L",
    measure: "tb_u",
    data: [
      { month: 0, L: 1, M: 49.88, S: 0.038 }, // Simplified params
      { month: 12, L: 1, M: 75.75, S: 0.034 },
      { month: 60, L: 1, M: 110, S: 0.043 },
    ],
  },
  // --- TB/U (Height for Age) GIRLS ---
  {
    sex: "P",
    measure: "tb_u",
    data: [
      { month: 0, L: 1, M: 49.15, S: 0.038 },
      { month: 12, L: 1, M: 74.02, S: 0.034 },
      { month: 60, L: 1, M: 109.4, S: 0.043 },
    ],
  },
];
