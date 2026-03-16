/**
 * WHO Child Growth Standards / Permenkes references loaded from CSV.
 * Source: src/config/datasets/who_growth_*.csv (split per measurement)
 */

import { readFileSync } from "node:fs";

type Sex = "L" | "P";
type Measure = "bb_u" | "tb_u" | "bb_tb" | "lk_u" | "lila_u" | "imt_u";

type ReferenceType = "month" | "height";

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
  sex: Sex;
  measure: "bb_u" | "tb_u" | "lk_u" | "lila_u" | "imt_u";
  data: LMSRecord[];
}

export interface GrowthStandardHeight {
  sex: Sex;
  measure: "bb_tb";
  data: HeightLMSRecord[];
}

type ParsedRow = {
  measure: Measure;
  sex: Sex;
  referenceType: ReferenceType;
  referenceValue: number;
  L: number;
  M: number;
  S: number;
};

type DatasetConfig = {
  measure: Measure;
  referenceType: ReferenceType;
  fileUrl: URL;
};

const DATASET_CONFIGS: DatasetConfig[] = [
  {
    measure: "bb_u",
    referenceType: "month",
    fileUrl: new URL(
      "../../config/datasets/who_growth_bb_u.csv",
      import.meta.url
    ),
  },
  {
    measure: "tb_u",
    referenceType: "month",
    fileUrl: new URL(
      "../../config/datasets/who_growth_tb_u.csv",
      import.meta.url
    ),
  },
  {
    measure: "bb_tb",
    referenceType: "height",
    fileUrl: new URL(
      "../../config/datasets/who_growth_bb_tb.csv",
      import.meta.url
    ),
  },
  {
    measure: "lk_u",
    referenceType: "month",
    fileUrl: new URL(
      "../../config/datasets/who_growth_lk_u.csv",
      import.meta.url
    ),
  },
  {
    measure: "lila_u",
    referenceType: "month",
    fileUrl: new URL(
      "../../config/datasets/who_growth_lila_u.csv",
      import.meta.url
    ),
  },
  {
    measure: "imt_u",
    referenceType: "month",
    fileUrl: new URL(
      "../../config/datasets/who_growth_imt_u.csv",
      import.meta.url
    ),
  },
];

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function isSex(value: string): value is Sex {
  return value === "L" || value === "P";
}

function isReferenceType(value: string): value is ReferenceType {
  return value === "month" || value === "height";
}

function parseMetadataAndDataLines(content: string): {
  metadata: Map<string, string>;
  dataLines: string[];
} {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const metadata = new Map<string, string>();
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#")) {
      const raw = line.slice(1).trim();
      const separator = raw.indexOf(":");
      if (separator >= 0) {
        const key = raw.slice(0, separator).trim().toLowerCase();
        const value = raw.slice(separator + 1).trim();
        metadata.set(key, value);
      }
      continue;
    }
    dataLines.push(line);
  }

  return { metadata, dataLines };
}

function validateDatasetMetadata(
  filePath: string,
  metadata: Map<string, string>
) {
  const version = metadata.get("version");
  const lastUpdated = metadata.get("lastupdated");
  const source = metadata.get("source");

  if (!version || !lastUpdated || !source) {
    throw new Error(
      `Missing metadata in ${filePath}: version, lastUpdated, and source are required`
    );
  }

  const parsedDate = new Date(lastUpdated);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new TypeError(
      `Invalid lastUpdated metadata in ${filePath}: ${lastUpdated}`
    );
  }

  return { version, lastUpdated, source };
}

function parseDatasetRow(line: string, config: DatasetConfig): ParsedRow {
  const [sex, referenceType, refRaw, lRaw, mRaw, sRaw] = parseCsvRow(line);

  if (!isSex(sex)) {
    throw new Error(`Invalid sex in ${config.fileUrl.pathname}: ${sex}`);
  }

  if (!isReferenceType(referenceType)) {
    throw new Error(
      `Invalid referenceType in ${config.fileUrl.pathname}: ${referenceType}`
    );
  }

  if (referenceType !== config.referenceType) {
    throw new Error(
      `Unexpected referenceType in ${config.fileUrl.pathname}: expected ${config.referenceType}, got ${referenceType}`
    );
  }

  const referenceValue = Number(refRaw);
  const L = Number(lRaw);
  const M = Number(mRaw);
  const S = Number(sRaw);

  if (
    Number.isNaN(referenceValue) ||
    Number.isNaN(L) ||
    Number.isNaN(M) ||
    Number.isNaN(S)
  ) {
    throw new TypeError(
      `Invalid numeric row in ${config.fileUrl.pathname}: ${line}`
    );
  }

  return {
    measure: config.measure,
    sex,
    referenceType,
    referenceValue,
    L,
    M,
    S,
  };
}

function parseDatasetCsv(config: DatasetConfig): ParsedRow[] {
  const content = readFileSync(config.fileUrl, "utf-8");
  const { metadata, dataLines } = parseMetadataAndDataLines(content);
  validateDatasetMetadata(config.fileUrl.pathname, metadata);

  if (dataLines.length < 2) {
    throw new Error(
      `${config.fileUrl.pathname} must have header and data rows`
    );
  }

  const headers = parseCsvRow(dataLines[0]);
  const expectedHeaders = [
    "sex",
    "referenceType",
    "referenceValue",
    "L",
    "M",
    "S",
  ];

  if (headers.join(",") !== expectedHeaders.join(",")) {
    throw new Error(`Invalid CSV header format in ${config.fileUrl.pathname}`);
  }

  const parsedRows: ParsedRow[] = [];

  for (const line of dataLines.slice(1)) {
    parsedRows.push(parseDatasetRow(line, config));
  }

  return parsedRows;
}

const PARSED_ROWS = DATASET_CONFIGS.flatMap((config) =>
  parseDatasetCsv(config)
);

function buildMonthData(
  measure: Exclude<Measure, "bb_tb">,
  sex: Sex
): LMSRecord[] {
  return PARSED_ROWS.filter(
    (row) =>
      row.measure === measure &&
      row.sex === sex &&
      row.referenceType === "month"
  )
    .sort((a, b) => a.referenceValue - b.referenceValue)
    .map((row) => ({
      month: row.referenceValue,
      L: row.L,
      M: row.M,
      S: row.S,
    }));
}

function buildHeightData(sex: Sex): HeightLMSRecord[] {
  return PARSED_ROWS.filter(
    (row) =>
      row.measure === "bb_tb" &&
      row.sex === sex &&
      row.referenceType === "height"
  )
    .sort((a, b) => a.referenceValue - b.referenceValue)
    .map((row) => ({
      height: row.referenceValue,
      L: row.L,
      M: row.M,
      S: row.S,
    }));
}

export const BB_U_BOYS_DATA: LMSRecord[] = buildMonthData("bb_u", "L");
export const BB_U_GIRLS_DATA: LMSRecord[] = buildMonthData("bb_u", "P");

export const TB_U_BOY_DATA: LMSRecord[] = buildMonthData("tb_u", "L");
export const TB_U_GIRL_DATA: LMSRecord[] = buildMonthData("tb_u", "P");

export const BB_TB_BOY_DATA: HeightLMSRecord[] = buildHeightData("L");
export const BB_TB_GIRL_DATA: HeightLMSRecord[] = buildHeightData("P");

export const LK_U_BOY_DATA: LMSRecord[] = buildMonthData("lk_u", "L");
export const LK_U_GIRL_DATA: LMSRecord[] = buildMonthData("lk_u", "P");

export const LILA_U_BOY_DATA: LMSRecord[] = buildMonthData("lila_u", "L");
export const LILA_U_GIRL_DATA: LMSRecord[] = buildMonthData("lila_u", "P");

export const IMT_U_BOY_DATA: LMSRecord[] = buildMonthData("imt_u", "L");
export const IMT_U_GIRL_DATA: LMSRecord[] = buildMonthData("imt_u", "P");

export const WHO_STANDARDS: (GrowthStandard | GrowthStandardHeight)[] = [
  { sex: "L", measure: "bb_u", data: BB_U_BOYS_DATA },
  { sex: "P", measure: "bb_u", data: BB_U_GIRLS_DATA },
  { sex: "L", measure: "tb_u", data: TB_U_BOY_DATA },
  { sex: "P", measure: "tb_u", data: TB_U_GIRL_DATA },
  { sex: "L", measure: "bb_tb", data: BB_TB_BOY_DATA },
  { sex: "P", measure: "bb_tb", data: BB_TB_GIRL_DATA },
  { sex: "L", measure: "lk_u", data: LK_U_BOY_DATA },
  { sex: "P", measure: "lk_u", data: LK_U_GIRL_DATA },
  { sex: "L", measure: "lila_u", data: LILA_U_BOY_DATA },
  { sex: "P", measure: "lila_u", data: LILA_U_GIRL_DATA },
  { sex: "L", measure: "imt_u", data: IMT_U_BOY_DATA },
  { sex: "P", measure: "imt_u", data: IMT_U_GIRL_DATA },
];
