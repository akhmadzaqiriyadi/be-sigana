import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { UnauthorizedError } from "@/utils/ApiError";
import { growthService } from "./growth.service";

function splitCsvParam(value: unknown): string[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function shouldReturnNotModified(
  req: Request,
  etag: string,
  lastModified: Date
): boolean {
  const ifNoneMatch = req.headers["if-none-match"];
  if (typeof ifNoneMatch === "string" && ifNoneMatch === etag) {
    return true;
  }

  const ifModifiedSince = req.headers["if-modified-since"];
  if (typeof ifModifiedSince === "string") {
    const modifiedSince = new Date(ifModifiedSince);
    if (
      !Number.isNaN(modifiedSince.getTime()) &&
      Math.floor(lastModified.getTime() / 1000) <=
        Math.floor(modifiedSince.getTime() / 1000)
    ) {
      return true;
    }
  }

  return false;
}

export const getGrowthBootstrap = asyncHandler(
  async (req: Request, res: Response) => {
    const [versionInfo, bootstrap] = await Promise.all([
      growthService.getVersionInfo(),
      growthService.getBootstrap(),
    ]);

    res.setHeader("ETag", versionInfo.etag);
    res.setHeader("Last-Modified", versionInfo.lastModified.toUTCString());
    res.setHeader("Cache-Control", "private, must-revalidate");

    if (
      shouldReturnNotModified(req, versionInfo.etag, versionInfo.lastModified)
    ) {
      return res.status(304).end();
    }

    sendSuccess(res, "Growth bootstrap berhasil diambil", bootstrap);
  }
);

export const getGrowthDatasets = asyncHandler(
  async (req: Request, res: Response) => {
    const measures = splitCsvParam(req.query.measures);
    const sexes = splitCsvParam(req.query.sex);

    const datasets = await growthService.getDatasets({
      measures: measures as Array<
        "bb_u" | "tb_u" | "bb_tb" | "lk_u" | "lila_u" | "imt_u"
      >,
      sexes: sexes as Array<"L" | "P">,
    });

    sendSuccess(res, "Dataset growth WHO berhasil diambil", datasets);
  }
);

export const getGrowthVersion = asyncHandler(
  async (req: Request, res: Response) => {
    const versionInfo = await growthService.getVersionInfo();

    res.setHeader("ETag", versionInfo.etag);
    res.setHeader("Last-Modified", versionInfo.lastModified.toUTCString());
    res.setHeader("Cache-Control", "private, must-revalidate");

    if (
      shouldReturnNotModified(req, versionInfo.etag, versionInfo.lastModified)
    ) {
      return res.status(304).end();
    }

    sendSuccess(res, "Growth version berhasil diambil", {
      version: versionInfo.version,
      generatedAt: versionInfo.generatedAt,
      lastModified: versionInfo.lastModified.toISOString(),
    });
  }
);

export const getGrowthClassificationRules = asyncHandler(
  async (_req: Request, res: Response) => {
    const rules = await growthService.getClassificationRulesPublic();
    sendSuccess(res, "Aturan klasifikasi growth berhasil diambil", rules);
  }
);

export const updateGrowthClassificationRules = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const rules = await growthService.updateClassificationRules(
      req.body,
      req.user.email
    );

    sendSuccess(res, "Aturan klasifikasi growth berhasil diperbarui", rules);
  }
);

export const resetGrowthClassificationRules = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const rules = await growthService.resetClassificationRules(req.user.email);

    sendSuccess(
      res,
      "Aturan klasifikasi growth berhasil direset ke nilai default",
      rules
    );
  }
);
