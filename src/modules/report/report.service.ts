import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import prisma from "@/config/db";
import { ReportFormat, ReportStatus } from "@prisma/client";
import { NotFoundError } from "@/utils/ApiError";
import { logger } from "@/utils/logger";
import { env } from "@/config/env";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateReportDTO {
  period: "3_months" | "6_months" | "1_year" | "custom";
  startDate?: string;
  endDate?: string;

  wilayah?: {
    kecamatan?: string;
    desaIds?: string[];
  };

  statusGizi?: ("Normal" | "Warning" | "Faltering" | "Gizi Buruk")[];

  parameterGrafik?: {
    bbu?: boolean;
    pbu?: boolean;
    bbpb?: boolean;
    lku?: boolean;
    imtu?: boolean;
    lilau?: boolean;
  };

  faktorRisiko?: {
    sanitasi?: boolean;
    ksi?: boolean;
    lilaRisiko?: boolean;
  };

  format: "pdf" | "excel" | "csv";
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_DIR = resolve("reports_storage");

function ensureStorageDir(): void {
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function buildDownloadUrl(reportId: string): string {
  const base = env.APP_URL.replace(/\/$/, "");
  return `${base}/api/v1/reports/${reportId}/download`;
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

function resolveDateRange(dto: GenerateReportDTO): { gte: Date; lte: Date } {
  const now = new Date();
  if (dto.period === "custom") {
    return {
      gte: new Date(dto.startDate!),
      lte: new Date(dto.endDate!),
    };
  }
  let days = 365;
  if (dto.period === "3_months") days = 90;
  else if (dto.period === "6_months") days = 180;
  return {
    gte: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    lte: now,
  };
}

// ---------------------------------------------------------------------------
// Status mapping (FE label → Prisma enum value)
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, string> = {
  Normal: "HIJAU",
  Warning: "KUNING",
  Faltering: "MERAH",
  "Gizi Buruk": "MERAH",
};

// ---------------------------------------------------------------------------
// Report title builder
// ---------------------------------------------------------------------------

function buildTitle(dto: GenerateReportDTO): string {
  const periodLabels: Record<string, string> = {
    "3_months": "3 Bulan",
    "6_months": "6 Bulan",
    "1_year": "1 Tahun",
    custom: "Kustom",
  };
  const periodLabel = periodLabels[dto.period] ?? dto.period;
  let wilayah = "";
  if (dto.wilayah?.kecamatan) {
    wilayah = ` \u2014 ${dto.wilayah.kecamatan}`;
  } else if (dto.wilayah?.desaIds?.length) {
    wilayah = ` \u2014 ${dto.wilayah.desaIds.length} Desa`;
  }
  return `Laporan Gizi ${periodLabel}${wilayah}`;
}

// ---------------------------------------------------------------------------
// Query measurements from DB
// ---------------------------------------------------------------------------

async function fetchMeasurements(dto: GenerateReportDTO) {
  const dateRange = resolveDateRange(dto);

  const where: Record<string, unknown> = {
    deletedAt: null,
    createdAt: dateRange,
  };

  // Wilayah filter
  if (dto.wilayah?.kecamatan || dto.wilayah?.desaIds?.length) {
    const villageWhere: Record<string, unknown> = {};
    if (dto.wilayah.kecamatan) {
      villageWhere.districts = {
        contains: dto.wilayah.kecamatan,
        mode: "insensitive",
      };
    }
    if (dto.wilayah.desaIds?.length) {
      villageWhere.id = { in: dto.wilayah.desaIds.map(Number) };
    }
    where.balita = { village: villageWhere };
  }

  // StatusGizi filter
  if (dto.statusGizi?.length) {
    const statusValues = [
      ...new Set(dto.statusGizi.map((s) => STATUS_MAP[s]).filter(Boolean)),
    ];
    where.statusAkhir = { in: statusValues };

    // Distinguish Gizi Buruk (MERAH + bb_tb_status contains 'Buruk') from Faltering
    const hasBuruk = dto.statusGizi.includes("Gizi Buruk");
    const hasFaltering = dto.statusGizi.includes("Faltering");
    if (hasBuruk && !hasFaltering) {
      where.bb_tb_status = { contains: "Buruk" };
    } else if (hasFaltering && !hasBuruk) {
      where.bb_tb_status = { not: { contains: "Buruk" } };
    }
  }

  // FaktorRisiko filters
  if (dto.faktorRisiko?.sanitasi) {
    where.sanitationData = { path: ["isSanitasiBuruk"], equals: true };
  }
  if (dto.faktorRisiko?.ksi) {
    where.medicalHistoryData = { path: ["isKsiRendah"], equals: true };
  }
  if (dto.faktorRisiko?.lilaRisiko) {
    where.lila = { lt: 11.5 };
  }

  const measurements = await prisma.measurement.findMany({
    where,
    include: {
      balita: {
        include: {
          village: { select: { id: true, name: true, districts: true } },
        },
      },
      relawan: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return measurements;
}

// ---------------------------------------------------------------------------
// Row builder for spreadsheet/CSV
// ---------------------------------------------------------------------------

function buildRows(
  measurements: Awaited<ReturnType<typeof fetchMeasurements>>,
  dto: GenerateReportDTO
) {
  const pg = dto.parameterGrafik ?? {};

  const baseHeaders = [
    "No",
    "Nama Anak",
    "Nama Ortu",
    "Jenis Kelamin",
    "Tanggal Lahir",
    "Desa",
    "Kecamatan",
    "Berat Badan (kg)",
    "Tinggi Badan (cm)",
    "LILA (cm)",
    "Lingkar Kepala (cm)",
    "Tanggal Pengukuran",
    "Diukur Oleh",
    "Status Akhir",
  ];

  const paramHeaders: string[] = [];
  if (pg.bbu !== false) paramHeaders.push("BB/U Status");
  if (pg.pbu !== false) paramHeaders.push("PB/TB/U Status");
  if (pg.bbpb !== false) paramHeaders.push("BB/PB/TB Status");
  if (pg.lku !== false) paramHeaders.push("LK/U Status");
  if (pg.imtu !== false) paramHeaders.push("IMT/U Status");
  if (pg.lilau !== false) paramHeaders.push("LiLA/U Status");

  const headers = [...baseHeaders, ...paramHeaders];

  const rows = measurements.map((m, idx) => {
    let statusLabel = "Normal";
    if (m.statusAkhir === "KUNING") statusLabel = "Waspada";
    else if (m.statusAkhir === "MERAH") statusLabel = "Buruk";

    const base = [
      idx + 1,
      m.balita.namaAnak,
      m.balita.namaOrtu,
      m.balita.jenisKelamin === "L" ? "Laki-laki" : "Perempuan",
      m.balita.tanggalLahir.toISOString().split("T")[0],
      m.balita.village.name,
      m.balita.village.districts,
      m.beratBadan,
      m.tinggiBadan,
      m.lila,
      m.lingkarKepala,
      m.createdAt.toISOString().split("T")[0],
      m.relawan.name,
      statusLabel,
    ];

    const params: (string | null)[] = [];
    if (pg.bbu !== false) params.push(m.bb_u_status ?? "-");
    if (pg.pbu !== false) params.push(m.tb_u_status ?? "-");
    if (pg.bbpb !== false) params.push(m.bb_tb_status ?? "-");
    if (pg.lku !== false) params.push(m.lk_u_status ?? "-");
    if (pg.imtu !== false) params.push(m.imt_u_status ?? "-");
    if (pg.lilau !== false) params.push(m.lila_u_status ?? "-");

    return [...base, ...params];
  });

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// File generators
// ---------------------------------------------------------------------------

function generateCsvBuffer(
  headers: string[],
  rows: (string | number | null)[][]
): Buffer {
  const escape = (val: string | number | null | undefined) => {
    const str = val != null ? String(val) : "";
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };
  const allRows: (string | number | null | undefined)[][] = [headers, ...rows];
  const lines = allRows.map((row) => row.map(escape).join(","));
  return Buffer.from(lines.join("\n"), "utf-8");
}

function generateExcelBuffer(
  title: string,
  headers: string[],
  rows: (string | number | null)[][]
): Buffer {
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, "Laporan Gizi");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

function generatePdfBuffer(
  title: string,
  headers: string[],
  rows: (string | number | null)[][]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      layout: "landscape",
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.fontSize(16).font("Helvetica-Bold").text(title, { align: "center" });
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Digenerate: ${new Date().toLocaleString("id-ID")}`, {
        align: "center",
      });
    doc.moveDown();

    // Summary line
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(`Total Data: ${rows.length} pengukuran`);
    doc.moveDown(0.5);

    // Table (simple text layout)
    const colWidth = 65;
    const startX = doc.page.margins.left;
    let y = doc.y;

    const drawRow = (cells: string[], isBold = false) => {
      doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      cells.slice(0, 12).forEach((cell, i) => {
        doc.text(
          String(cell ?? "").substring(0, 15),
          startX + i * colWidth,
          y,
          {
            width: colWidth - 4,
            lineBreak: false,
          }
        );
      });
      y += 14;
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    };

    drawRow(headers.slice(0, 12), true);
    // separator line
    doc
      .moveTo(startX, y - 2)
      .lineTo(startX + 12 * colWidth, y - 2)
      .stroke();

    rows.forEach((row) => drawRow(row.map(String)));

    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class ReportService {
  /**
   * Create a Report record (PROCESSING) and kick off background generation.
   */
  async generate(dto: GenerateReportDTO, userId: string) {
    const title = buildTitle(dto);
    const formatMap: Record<string, ReportFormat> = {
      pdf: "PDF",
      excel: "EXCEL",
      csv: "CSV",
    };

    const report = await prisma.report.create({
      data: {
        title,
        format: formatMap[dto.format],
        status: "PROCESSING",
        config: dto as object,
        generatedById: userId,
      },
    });

    // Kick off background generation (not awaited)
    this._processReport(report.id, dto).catch((err) => {
      logger.error(`Report generation failed for ${report.id}: ${err.message}`);
    });

    return {
      reportId: report.id,
      status: "processing" as const,
      estimatedTime: 5,
      downloadUrl: null,
    };
  }

  /**
   * Background processing: query data, generate file, update DB.
   */
  private async _processReport(reportId: string, dto: GenerateReportDTO) {
    try {
      ensureStorageDir();
      const measurements = await fetchMeasurements(dto);
      const title = buildTitle(dto);
      const { headers, rows } = buildRows(measurements, dto);

      let fileBuffer: Buffer;
      let ext: string;

      if (dto.format === "csv") {
        fileBuffer = generateCsvBuffer(headers, rows);
        ext = "csv";
      } else if (dto.format === "excel") {
        fileBuffer = generateExcelBuffer(title, headers, rows);
        ext = "xlsx";
      } else {
        fileBuffer = await generatePdfBuffer(title, headers, rows);
        ext = "pdf";
      }

      const fileName = `${reportId}.${ext}`;
      const filePath = join(STORAGE_DIR, fileName);
      writeFileSync(filePath, fileBuffer);

      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "DONE",
          filePath,
          generatedAt: new Date(),
        },
      });

      logger.info(`Report ${reportId} generated successfully (${ext})`);
    } catch (err: unknown) {
      logger.error(
        `Report ${reportId} failed: ${err instanceof Error ? err.message : String(err)}`
      );
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "FAILED" },
      });
    }
  }

  /**
   * GET /reports/:id/status
   */
  async getStatus(reportId: string, _userId: string) {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { generatedBy: { select: { id: true, name: true } } },
    });

    if (!report) throw new NotFoundError("Laporan tidak ditemukan");

    const statusLabel: Record<ReportStatus, string> = {
      PROCESSING: "processing",
      DONE: "done",
      FAILED: "failed",
    };

    const downloadUrl =
      report.status === "DONE" ? buildDownloadUrl(report.id) : null;

    return {
      reportId: report.id,
      status: statusLabel[report.status],
      downloadUrl,
      generatedAt: report.generatedAt,
    };
  }

  /**
   * GET /reports/:id/download — stream the file
   */
  async getFilePath(reportId: string): Promise<{
    filePath: string;
    format: string;
    title: string;
  }> {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) throw new NotFoundError("Laporan tidak ditemukan");
    if (report.status === "PROCESSING") {
      throw new NotFoundError("Laporan masih dalam proses");
    }
    if (report.status === "FAILED") {
      throw new NotFoundError("Laporan gagal di-generate");
    }
    if (!report.filePath || !existsSync(report.filePath)) {
      throw new NotFoundError("File laporan tidak ditemukan");
    }

    return {
      filePath: report.filePath,
      format: report.format.toLowerCase(),
      title: report.title,
    };
  }

  /**
   * GET /reports/history
   */
  async getHistory(page: number, limit: number, userId: string, role: string) {
    const skip = (page - 1) * limit;

    // RELAWAN can only see their own reports; ADMIN/STAKEHOLDER see all
    const where = role === "RELAWAN" ? { generatedById: userId } : {};

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          generatedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);

    const data = reports.map((r) => ({
      id: r.id,
      title: r.title,
      format: r.format.toLowerCase(),
      status: r.status.toLowerCase(),
      generatedAt: r.generatedAt,
      downloadUrl: r.status === "DONE" ? buildDownloadUrl(r.id) : null,
      generatedBy: r.generatedBy,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const reportService = new ReportService();
