import { readFile } from "node:fs/promises";
import { logger } from "@/utils/logger";
import prisma from "@/config/db";

type CsvMetadata = {
  version: string;
  lastUpdated: string;
};

type ParsedCsv = {
  metadata: CsvMetadata;
  rows: Record<string, string>[];
};

const WHO_CSV_URL = new URL("./datasets/who_datasets.csv", import.meta.url);

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function requireValidDate(label: string, value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} is invalid date: ${value}`);
  }
  return date;
}

function parseCsv(content: string): ParsedCsv {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const metadataMap = new Map<string, string>();
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#")) {
      const raw = line.slice(1).trim();
      const separator = raw.indexOf(":");
      if (separator >= 0) {
        const key = raw.slice(0, separator).trim().toLowerCase();
        const value = raw.slice(separator + 1).trim();
        metadataMap.set(key, value);
      }
      continue;
    }

    dataLines.push(line);
  }

  const version = metadataMap.get("version");
  const lastUpdated = metadataMap.get("lastupdated");

  if (!version) {
    throw new Error("CSV metadata 'version' is required");
  }

  if (!lastUpdated) {
    throw new Error("CSV metadata 'lastUpdated' is required");
  }

  requireValidDate("CSV metadata lastUpdated", lastUpdated);

  if (dataLines.length < 2) {
    throw new Error("CSV must contain header and at least one data row");
  }

  const headers = splitCsvLine(dataLines[0]);
  const rows = dataLines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });

  return {
    metadata: {
      version,
      lastUpdated,
    },
    rows,
  };
}

async function parseCsvFile(url: URL): Promise<ParsedCsv> {
  const content = await readFile(url, "utf-8");
  return parseCsv(content);
}

function parseBoolean(value: string, fallback = true): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

async function bootstrapWhoFromCsv() {
  const parsed = await parseCsvFile(WHO_CSV_URL);

  const rows = parsed.rows.map((row) => {
    const code = row.code?.trim();
    const label = row.label?.trim();
    const description = row.description?.trim();
    const version = row.version?.trim() || parsed.metadata.version;
    const lastUpdated = row.lastUpdated?.trim() || parsed.metadata.lastUpdated;
    const ageRange = row.ageRange?.trim();
    const isActive = parseBoolean(row.isActive, true);

    if (!code) throw new Error("WHO CSV row is missing code");
    if (!label) throw new Error(`WHO CSV row ${code} is missing label`);
    if (!description) {
      throw new Error(`WHO CSV row ${code} is missing description`);
    }
    if (!version) throw new Error(`WHO CSV row ${code} is missing version`);
    if (!lastUpdated) {
      throw new Error(`WHO CSV row ${code} is missing lastUpdated`);
    }
    if (!ageRange) throw new Error(`WHO CSV row ${code} is missing ageRange`);

    requireValidDate(`WHO CSV row ${code} lastUpdated`, lastUpdated);

    return {
      code,
      label,
      description,
      version,
      lastUpdated: new Date(lastUpdated),
      ageRange,
      isActive,
    };
  });

  const codeSet = new Set(rows.map((row) => row.code));
  if (codeSet.size !== rows.length) {
    throw new Error("WHO CSV contains duplicate code entries");
  }

  await prisma.whoDataset.deleteMany({
    where: {
      code: {
        notIn: Array.from(codeSet),
      },
    },
  });

  for (const row of rows) {
    await prisma.whoDataset.upsert({
      where: { code: row.code },
      create: row,
      update: {
        label: row.label,
        description: row.description,
        version: row.version,
        lastUpdated: row.lastUpdated,
        ageRange: row.ageRange,
        isActive: row.isActive,
      },
    });
  }

  await prisma.systemConfig.upsert({
    where: { id: "who_dataset_meta" },
    create: {
      id: "who_dataset_meta",
      value: {
        source: "config/datasets/who_datasets.csv",
        version: parsed.metadata.version,
        lastUpdated: parsed.metadata.lastUpdated,
        expectedCodes: Array.from(codeSet).sort((a, b) => a.localeCompare(b)),
      },
    },
    update: {
      value: {
        source: "config/datasets/who_datasets.csv",
        version: parsed.metadata.version,
        lastUpdated: parsed.metadata.lastUpdated,
        expectedCodes: Array.from(codeSet).sort((a, b) => a.localeCompare(b)),
      },
    },
  });

  return {
    version: parsed.metadata.version,
    lastUpdated: parsed.metadata.lastUpdated,
    rowCount: rows.length,
  };
}

export async function bootstrapWhoDatasetsFromCsv() {
  const whoResult = await bootstrapWhoFromCsv();

  logger.info("WHO dataset metadata imported from CSV", {
    who: whoResult,
  });

  return {
    who: whoResult,
  };
}
