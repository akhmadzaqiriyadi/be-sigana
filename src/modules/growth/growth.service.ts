import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/config/db";
import { settingsService } from "@/modules/settings/settings.service";
import { WHO_STANDARDS } from "@/utils/zscore/standards";
import { auditService } from "@/modules/audit/audit.service";

type GrowthMeasure = "bb_u" | "tb_u" | "bb_tb" | "lk_u" | "lila_u" | "imt_u";
type Sex = "L" | "P";
type ReferenceType = "month" | "height";

type DatasetRow = {
  referenceValue: number;
  L: number;
  M: number;
  S: number;
};

type GrowthDatasetResponse = {
  measure: GrowthMeasure;
  sex: Sex;
  referenceType: ReferenceType;
  rows: DatasetRow[];
};

type ClassificationBand = {
  label: string;
  minInclusive?: number;
  minExclusive?: number;
  maxInclusive?: number;
  maxExclusive?: number;
};

type ClassificationRule = {
  outlierAbs: number;
  bands: ClassificationBand[];
};

type GrowthClassificationRules = Record<GrowthMeasure, ClassificationRule>;

type DatasetMetaEntry = {
  version: string;
  lastUpdated: string;
  sourceCodes: string[];
};

type GrowthVersionInfo = {
  version: string;
  generatedAt: string;
  lastModified: Date;
  etag: string;
};

const MEASURES: GrowthMeasure[] = [
  "bb_u",
  "tb_u",
  "bb_tb",
  "lk_u",
  "lila_u",
  "imt_u",
];

const CODE_TO_MEASURE: Record<string, GrowthMeasure> = {
  BB_U: "bb_u",
  TB_U: "tb_u",
  PB_U: "tb_u",
  BB_TB: "bb_tb",
  BB_PB: "bb_tb",
  LK_U: "lk_u",
  LILA_U: "lila_u",
  IMT_U: "imt_u",
};

const DEFAULT_CLASSIFICATION_RULES: GrowthClassificationRules = {
  bb_u: {
    outlierAbs: 5,
    bands: [
      { label: "Berat Badan Sangat Kurang", maxExclusive: -3 },
      { label: "Berat Badan Kurang", minInclusive: -3, maxExclusive: -2 },
      { label: "Berat Badan Normal", minInclusive: -2, maxInclusive: 1 },
      { label: "Risiko Berat Badan Lebih", minExclusive: 1 },
    ],
  },
  tb_u: {
    outlierAbs: 5,
    bands: [
      { label: "Sangat Pendek", maxExclusive: -3 },
      { label: "Pendek", minInclusive: -3, maxExclusive: -2 },
      { label: "Normal", minInclusive: -2, maxInclusive: 3 },
      { label: "Tinggi", minExclusive: 3 },
    ],
  },
  bb_tb: {
    outlierAbs: 5,
    bands: [
      { label: "Gizi Buruk", maxExclusive: -3 },
      { label: "Gizi Kurang", minInclusive: -3, maxExclusive: -2 },
      { label: "Gizi Baik", minInclusive: -2, maxInclusive: 1 },
      { label: "Berisiko Gizi Lebih", minExclusive: 1, maxInclusive: 2 },
      { label: "Gizi Lebih", minExclusive: 2, maxInclusive: 3 },
      { label: "Obesitas", minExclusive: 3 },
    ],
  },
  lk_u: {
    outlierAbs: 5,
    bands: [
      { label: "Mikrocepali", maxExclusive: -2 },
      { label: "Normal", minInclusive: -2, maxInclusive: 2 },
      { label: "Makrocepali", minExclusive: 2 },
    ],
  },
  lila_u: {
    outlierAbs: 5,
    bands: [
      { label: "Gizi Buruk", maxExclusive: -3 },
      { label: "Gizi Kurang", minInclusive: -3, maxExclusive: -2 },
      { label: "Gizi Baik", minInclusive: -2, maxInclusive: 2 },
      { label: "Gizi Lebih", minExclusive: 2 },
    ],
  },
  imt_u: {
    outlierAbs: 5,
    bands: [
      { label: "Sangat Kurus", maxExclusive: -3 },
      { label: "Kurus", minInclusive: -3, maxExclusive: -2 },
      { label: "Gizi Baik", minInclusive: -2, maxInclusive: 1 },
      { label: "Berisiko Gemuk", minExclusive: 1, maxInclusive: 2 },
      { label: "Gemuk", minExclusive: 2, maxInclusive: 3 },
      { label: "Obesitas", minExclusive: 3 },
    ],
  },
};

function toIsoDate(date: Date | null | undefined): string {
  return date ? date.toISOString() : new Date(0).toISOString();
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(input as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right)
  );

  return `{${entries
    .map(([key, value]) => `${JSON.stringify(key)}:${stableStringify(value)}`)
    .join(",")}}`;
}

export class GrowthService {
  private buildDatasetsPayload(): GrowthDatasetResponse[] {
    const datasets = WHO_STANDARDS.map((dataset) => {
      const referenceType: ReferenceType =
        dataset.measure === "bb_tb" ? "height" : "month";
      const rows = dataset.data.map((row) => ({
        referenceValue: "month" in row ? row.month : row.height,
        L: row.L,
        M: row.M,
        S: row.S,
      }));

      return {
        measure: dataset.measure,
        sex: dataset.sex,
        referenceType,
        rows,
      };
    });

    const sortedDatasets = [...datasets];
    sortedDatasets.sort((left, right) => {
      if (left.measure === right.measure) {
        return left.sex.localeCompare(right.sex);
      }
      return left.measure.localeCompare(right.measure);
    });

    return sortedDatasets;
  }

  private async getClassificationRules(): Promise<GrowthClassificationRules> {
    const override = await prisma.systemConfig.findUnique({
      where: { id: "growth_classification_rules" },
    });

    if (!override || typeof override.value !== "object" || !override.value) {
      return DEFAULT_CLASSIFICATION_RULES;
    }

    const parsed = override.value as Partial<GrowthClassificationRules>;
    const merged: GrowthClassificationRules = {
      bb_u: parsed.bb_u ?? DEFAULT_CLASSIFICATION_RULES.bb_u,
      tb_u: parsed.tb_u ?? DEFAULT_CLASSIFICATION_RULES.tb_u,
      bb_tb: parsed.bb_tb ?? DEFAULT_CLASSIFICATION_RULES.bb_tb,
      lk_u: parsed.lk_u ?? DEFAULT_CLASSIFICATION_RULES.lk_u,
      lila_u: parsed.lila_u ?? DEFAULT_CLASSIFICATION_RULES.lila_u,
      imt_u: parsed.imt_u ?? DEFAULT_CLASSIFICATION_RULES.imt_u,
    };

    return merged;
  }

  async getClassificationRulesPublic(): Promise<GrowthClassificationRules> {
    return this.getClassificationRules();
  }

  async updateClassificationRules(
    value: Partial<GrowthClassificationRules>,
    updatedBy?: string
  ): Promise<GrowthClassificationRules> {
    const current = await this.getClassificationRules();
    const merged: GrowthClassificationRules = {
      bb_u: value.bb_u ?? current.bb_u,
      tb_u: value.tb_u ?? current.tb_u,
      bb_tb: value.bb_tb ?? current.bb_tb,
      lk_u: value.lk_u ?? current.lk_u,
      lila_u: value.lila_u ?? current.lila_u,
      imt_u: value.imt_u ?? current.imt_u,
    };

    await prisma.systemConfig.upsert({
      where: { id: "growth_classification_rules" },
      create: {
        id: "growth_classification_rules",
        value: merged as unknown as Prisma.InputJsonValue,
        updatedBy,
      },
      update: {
        value: merged as unknown as Prisma.InputJsonValue,
        updatedBy,
      },
    });

    await auditService.log("growth.classification_rules.updated", {
      actor: updatedBy,
      target: "growth_classification_rules",
      metadata: { updatedIndicators: Object.keys(value) },
    });

    return merged;
  }

  async resetClassificationRules(
    updatedBy?: string
  ): Promise<GrowthClassificationRules> {
    await prisma.systemConfig.deleteMany({
      where: { id: "growth_classification_rules" },
    });

    await auditService.log("growth.classification_rules.reset", {
      actor: updatedBy,
      target: "growth_classification_rules",
    });

    return DEFAULT_CLASSIFICATION_RULES;
  }

  private async getDatasetMeta() {
    const datasets = await prisma.whoDataset.findMany({
      select: {
        code: true,
        version: true,
        lastUpdated: true,
      },
      orderBy: { lastUpdated: "desc" },
    });

    const grouped = new Map<
      GrowthMeasure,
      { versions: Set<string>; latest: Date | null; sourceCodes: Set<string> }
    >();

    for (const measure of MEASURES) {
      grouped.set(measure, {
        versions: new Set<string>(),
        latest: null,
        sourceCodes: new Set<string>(),
      });
    }

    for (const dataset of datasets) {
      const measure = CODE_TO_MEASURE[dataset.code];
      if (!measure) {
        continue;
      }

      const group = grouped.get(measure);
      if (!group) {
        continue;
      }

      group.versions.add(dataset.version);
      group.sourceCodes.add(dataset.code);
      group.latest =
        !group.latest || dataset.lastUpdated.getTime() > group.latest.getTime()
          ? dataset.lastUpdated
          : group.latest;
    }

    const meta = MEASURES.reduce<Record<GrowthMeasure, DatasetMetaEntry>>(
      (acc, measure) => {
        const group = grouped.get(measure);
        acc[measure] = {
          version:
            group && group.versions.size > 0
              ? Array.from(group.versions).sort((left, right) =>
                  right.localeCompare(left)
                )[0]
              : "-",
          lastUpdated: toIsoDate(group?.latest),
          sourceCodes: group
            ? Array.from(group.sourceCodes).sort((left, right) =>
                left.localeCompare(right)
              )
            : [],
        };
        return acc;
      },
      {} as Record<GrowthMeasure, DatasetMetaEntry>
    );

    return meta;
  }

  private async computeVersionBase() {
    const [
      thresholdConfig,
      thresholdRow,
      whoMetaRow,
      classificationRules,
      datasetMeta,
    ] = await Promise.all([
      settingsService.getThresholdConfig(),
      prisma.systemConfig.findUnique({ where: { id: "threshold" } }),
      prisma.systemConfig.findUnique({ where: { id: "who_dataset_meta" } }),
      this.getClassificationRules(),
      this.getDatasetMeta(),
    ]);

    const whoMetaValue =
      whoMetaRow && typeof whoMetaRow.value === "object" && whoMetaRow.value
        ? (whoMetaRow.value as Record<string, unknown>)
        : null;

    const payload = {
      thresholdConfig,
      thresholdUpdatedAt: thresholdRow?.updatedAt.toISOString() ?? null,
      classificationRules,
      datasetMeta,
      whoMeta: whoMetaValue,
    };

    const digest = crypto
      .createHash("sha256")
      .update(stableStringify(payload))
      .digest("hex");

    const latestWhoUpdatedAt = Object.values(datasetMeta)
      .map((item) => new Date(item.lastUpdated))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((left, right) => right.getTime() - left.getTime())[0];

    const thresholdUpdatedAt = thresholdRow?.updatedAt;
    const whoUpdatedAt = whoMetaRow?.updatedAt ?? latestWhoUpdatedAt;

    const lastModifiedCandidates = [thresholdUpdatedAt, whoUpdatedAt].filter(
      (value): value is Date =>
        value instanceof Date && !Number.isNaN(value.getTime())
    );

    const sortedLastModifiedCandidates = [...lastModifiedCandidates];
    sortedLastModifiedCandidates.sort(
      (left, right) => right.getTime() - left.getTime()
    );

    const lastModified = sortedLastModifiedCandidates[0] ?? new Date(0);

    return {
      thresholdConfig,
      classificationRules,
      datasetMeta,
      version: `growth-config-${digest.slice(0, 16)}`,
      generatedAt: new Date().toISOString(),
      lastModified,
    };
  }

  async getBootstrap() {
    const versionBase = await this.computeVersionBase();

    return {
      version: versionBase.version,
      generatedAt: versionBase.generatedAt,
      threshold: versionBase.thresholdConfig,
      classificationRules: versionBase.classificationRules,
      datasetMeta: versionBase.datasetMeta,
    };
  }

  async getDatasets(filters: { measures?: GrowthMeasure[]; sexes?: Sex[] }) {
    const base = this.buildDatasetsPayload();

    const datasets = base.filter((dataset) => {
      const measureMatch =
        !filters.measures || filters.measures.length === 0
          ? true
          : filters.measures.includes(dataset.measure);
      const sexMatch =
        !filters.sexes || filters.sexes.length === 0
          ? true
          : filters.sexes.includes(dataset.sex);
      return measureMatch && sexMatch;
    });

    const versionSeed = {
      filters,
      counts: datasets.map((dataset) => ({
        measure: dataset.measure,
        sex: dataset.sex,
        rows: dataset.rows.length,
      })),
    };

    const digest = crypto
      .createHash("sha256")
      .update(stableStringify(versionSeed))
      .digest("hex");

    return {
      version: `who-lms-${digest.slice(0, 16)}`,
      datasets,
    };
  }

  async getVersionInfo(): Promise<GrowthVersionInfo> {
    const base = await this.computeVersionBase();
    const etag = `W/"${base.version}"`;

    return {
      version: base.version,
      generatedAt: base.generatedAt,
      lastModified: base.lastModified,
      etag,
    };
  }
}

export const growthService = new GrowthService();
