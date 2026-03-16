import { Request, Response } from "express";
import { createReadStream, statSync } from "node:fs";
import { extname } from "node:path";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { reportService } from "./report.service";
import { sendSuccess, sendCreated } from "@/utils/response";
import { BadRequestError, UnauthorizedError } from "@/utils/ApiError";

// ---------------------------------------------------------------------------
// POST /api/v1/reports/generate
// ---------------------------------------------------------------------------

export const generateReport = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const {
      period,
      startDate,
      endDate,
      wilayah,
      statusGizi,
      parameterGrafik,
      faktorRisiko,
      format,
    } = req.body;

    if (!period) throw new BadRequestError("Field 'period' wajib diisi");
    if (!format) throw new BadRequestError("Field 'format' wajib diisi");

    const validPeriods = ["3_months", "6_months", "1_year", "custom"];
    if (!validPeriods.includes(period)) {
      throw new BadRequestError(
        `period harus salah satu dari: ${validPeriods.join(", ")}`
      );
    }

    if (period === "custom" && (!startDate || !endDate)) {
      throw new BadRequestError(
        "startDate dan endDate wajib diisi jika period = 'custom'"
      );
    }

    const validFormats = ["pdf", "excel", "csv"];
    if (!validFormats.includes(format)) {
      throw new BadRequestError(
        `format harus salah satu dari: ${validFormats.join(", ")}`
      );
    }

    const result = await reportService.generate(
      {
        period,
        startDate,
        endDate,
        wilayah,
        statusGizi,
        parameterGrafik,
        faktorRisiko,
        format,
      },
      req.user.userId
    );

    sendCreated(res, "Laporan sedang diproses", result);
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/reports/:id/status
// ---------------------------------------------------------------------------

export const getReportStatus = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const id = String(req.params.id);
    const result = await reportService.getStatus(
      id,
      req.user.userId,
      req.user.role
    );
    sendSuccess(res, "Status laporan berhasil diambil", result);
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/reports/:id/download
// ---------------------------------------------------------------------------

export const downloadReport = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const id = String(req.params.id);

    const { filePath, title } = await reportService.getFilePath(
      id,
      req.user.userId,
      req.user.role
    );

    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv",
    };

    const ext = extname(filePath).replace(".", "");
    const mime = mimeTypes[ext] ?? "application/octet-stream";
    const safeTitle = title.replaceAll(/[^a-zA-Z0-9 \-_]/g, "").trim();
    const filename = `${safeTitle}.${ext}`;

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", statSync(filePath).size);

    const stream = createReadStream(filePath);
    stream.pipe(res);
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/reports/history
// ---------------------------------------------------------------------------

export const getReportHistory = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const page = Number.parseInt(String(req.query.page)) || 1;
    const limit = Number.parseInt(String(req.query.limit)) || 10;

    const result = await reportService.getHistory(
      page,
      limit,
      req.user.userId,
      req.user.role
    );

    sendSuccess(
      res,
      "Riwayat laporan berhasil diambil",
      result.data,
      result.meta
    );
  }
);
