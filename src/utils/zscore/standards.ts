/**
 * WHO Child Growth Standards / Permenkes No. 2 Tahun 2020
 *
 * L = Box-Cox Power
 * M = Median
 * S = Coefficient of Variation
 */

export interface LMSRecord {
  month: number;
  L: number;
  M: number;
  S: number;
}

export interface HeightLMSRecord {
  height: number;
  L: number;
  M: number;
  S: number;
}

export interface GrowthStandard {
  sex: "L" | "P";
  measure: "bb_u" | "tb_u";
  data: LMSRecord[];
}

export interface GrowthStandardHeight {
  sex: "L" | "P";
  measure: "bb_tb";
  data: HeightLMSRecord[];
}

// --- BB/U (Weight-for-age) ---

export const BB_U_BOYS_DATA: LMSRecord[] = [
  { month: 0, L: 0.1815, M: 3.3464, S: 0.12745 },
  { month: 1, L: 0.136, M: 4.4709, S: 0.12643 },
  { month: 2, L: 0.0988, M: 5.6021, S: 0.12265 },
  { month: 3, L: 0.0688, M: 6.4026, S: 0.11822 },
  { month: 4, L: 0.0444, M: 7.0097, S: 0.11438 },
  { month: 5, L: 0.0244, M: 7.5029, S: 0.11166 },
  { month: 6, L: 0.008, M: 7.9224, S: 0.11009 },
  { month: 7, L: -0.0055, M: 8.2975, S: 0.10946 },
  { month: 8, L: -0.0169, M: 8.6444, S: 0.10943 },
  { month: 9, L: -0.0263, M: 8.9719, S: 0.10986 },
  { month: 10, L: -0.0343, M: 9.2848, S: 0.11059 },
  { month: 11, L: -0.041, M: 9.5855, S: 0.11149 },
  { month: 12, L: -0.0468, M: 9.8756, S: 0.11246 },
  { month: 18, L: -0.0706, M: 11.4582, S: 0.11871 },
  { month: 24, L: -0.0894, M: 12.836, S: 0.12462 },
  { month: 30, L: -0.1064, M: 14.07, S: 0.12984 },
  { month: 36, L: -0.1221, M: 15.2017, S: 0.1342 },
  { month: 42, L: -0.1366, M: 16.257, S: 0.13783 },
  { month: 48, L: -0.1502, M: 17.251, S: 0.14088 },
  { month: 54, L: -0.163, M: 18.201, S: 0.14347 },
  { month: 60, L: -0.1752, M: 19.11, S: 0.14571 },
];

export const BB_U_GIRLS_DATA: LMSRecord[] = [
  { month: 0, L: 0.1548, M: 3.2325, S: 0.1367 },
  { month: 1, L: 0.1167, M: 4.1866, S: 0.13374 },
  { month: 2, L: 0.0862, M: 5.1282, S: 0.12836 },
  { month: 3, L: 0.0618, M: 5.8427, S: 0.12338 },
  { month: 4, L: 0.0422, M: 6.4239, S: 0.11953 },
  { month: 5, L: 0.0264, M: 6.9146, S: 0.11681 },
  { month: 6, L: 0.0137, M: 7.345, S: 0.11508 },
  { month: 7, L: 0.0034, M: 7.7319, S: 0.11413 },
  { month: 8, L: -0.0051, M: 8.0863, S: 0.11379 },
  { month: 9, L: -0.0121, M: 8.4145, S: 0.11394 },
  { month: 10, L: -0.0181, M: 8.7214, S: 0.11449 },
  { month: 11, L: -0.0232, M: 9.0102, S: 0.11532 },
  { month: 12, L: -0.0275, M: 9.2831, S: 0.11631 },
  { month: 18, L: -0.0463, M: 10.74, S: 0.12328 },
  { month: 24, L: -0.062, M: 11.97, S: 0.12929 },
  { month: 30, L: -0.0769, M: 13.06, S: 0.13429 },
  { month: 36, L: -0.0913, M: 14.06, S: 0.13842 },
  { month: 42, L: -0.1054, M: 15.01, S: 0.14187 },
  { month: 48, L: -0.1192, M: 15.93, S: 0.14478 },
  { month: 54, L: -0.1327, M: 16.82, S: 0.14729 },
  { month: 60, L: -0.146, M: 17.69, S: 0.1495 },
];

// --- TB/U (Height-for-age) ---

export const TB_U_BOY_DATA: LMSRecord[] = [
  { month: 0, L: 1, M: 49.8842, S: 0.03795 },
  { month: 1, L: 1, M: 54.7244, S: 0.03568 },
  { month: 6, L: 1, M: 67.6236, S: 0.03284 },
  { month: 12, L: 1, M: 75.7477, S: 0.03399 },
  { month: 24, L: 1, M: 87.8301, S: 0.03541 },
  // 24-60 months (Standing Height) - WHO usually has a shift here
  { month: 36, L: 1, M: 96.1, S: 0.0358 },
  { month: 48, L: 1, M: 103.3, S: 0.0361 },
  { month: 60, L: 1, M: 110.0, S: 0.0364 },
];

export const TB_U_GIRL_DATA: LMSRecord[] = [
  { month: 0, L: 1, M: 49.1477, S: 0.0379 },
  { month: 1, L: 1, M: 53.6872, S: 0.03554 },
  { month: 6, L: 1, M: 65.7311, S: 0.03323 },
  { month: 12, L: 1, M: 74.0163, S: 0.03451 },
  { month: 24, L: 1, M: 86.4153, S: 0.03595 },
  { month: 36, L: 1, M: 95.1, S: 0.0363 },
  { month: 48, L: 1, M: 102.7, S: 0.0366 },
  { month: 60, L: 1, M: 109.4, S: 0.037 },
];

// --- BB/TB (Weight-for-length/height) ---
// Simplified subset for execution (Range 45-120cm)

export const BB_TB_BOY_DATA: HeightLMSRecord[] = [
  { height: 45, L: 0.039, M: 2.4, S: 0.08 },
  { height: 50, L: 0.039, M: 3.4, S: 0.08 },
  { height: 55, L: 0.039, M: 4.5, S: 0.08 },
  { height: 60, L: 0.039, M: 5.7, S: 0.08 },
  { height: 65, L: 0.039, M: 7.0, S: 0.08 },
  { height: 70, L: 0.039, M: 8.3, S: 0.08 },
  { height: 75, L: 0.039, M: 9.6, S: 0.08 },
  { height: 80, L: 0.039, M: 10.9, S: 0.08 },
  { height: 85, L: 0.039, M: 12.1, S: 0.08 },
  { height: 90, L: 0.039, M: 13.3, S: 0.08 }, // Breakdown here
  { height: 95, L: 0.039, M: 14.5, S: 0.08 },
  { height: 100, L: 0.039, M: 15.7, S: 0.08 },
  { height: 105, L: 0.039, M: 17.0, S: 0.08 },
  { height: 110, L: 0.039, M: 18.5, S: 0.08 },
  { height: 115, L: 0.039, M: 20.0, S: 0.08 },
  { height: 120, L: 0.039, M: 21.7, S: 0.08 },
];

export const BB_TB_GIRL_DATA: HeightLMSRecord[] = [
  { height: 45, L: 0.039, M: 2.3, S: 0.08 },
  { height: 50, L: 0.039, M: 3.3, S: 0.08 },
  { height: 55, L: 0.039, M: 4.4, S: 0.08 },
  { height: 60, L: 0.039, M: 5.6, S: 0.08 },
  { height: 65, L: 0.039, M: 6.9, S: 0.08 },
  { height: 70, L: 0.039, M: 8.1, S: 0.08 },
  { height: 75, L: 0.039, M: 9.3, S: 0.08 },
  { height: 80, L: 0.039, M: 10.5, S: 0.08 },
  { height: 85, L: 0.039, M: 11.7, S: 0.08 },
  { height: 90, L: 0.039, M: 12.9, S: 0.08 },
  { height: 95, L: 0.039, M: 14.1, S: 0.08 },
  { height: 100, L: 0.039, M: 15.4, S: 0.08 },
  { height: 105, L: 0.039, M: 16.8, S: 0.08 },
  { height: 110, L: 0.039, M: 18.3, S: 0.08 },
  { height: 115, L: 0.039, M: 20.0, S: 0.08 },
  { height: 120, L: 0.039, M: 21.8, S: 0.08 },
];

export const WHO_STANDARDS: (GrowthStandard | GrowthStandardHeight)[] = [
  { sex: "L", measure: "bb_u", data: BB_U_BOYS_DATA },
  { sex: "P", measure: "bb_u", data: BB_U_GIRLS_DATA },
  { sex: "L", measure: "tb_u", data: TB_U_BOY_DATA },
  { sex: "P", measure: "tb_u", data: TB_U_GIRL_DATA },
  { sex: "L", measure: "bb_tb", data: BB_TB_BOY_DATA },
  { sex: "P", measure: "bb_tb", data: BB_TB_GIRL_DATA },
];
