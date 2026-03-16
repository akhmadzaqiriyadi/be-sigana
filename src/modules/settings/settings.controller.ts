import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { UnauthorizedError } from "@/utils/ApiError";
import { settingsService } from "./settings.service";

export const getThresholdConfig = asyncHandler(
  async (_req: Request, res: Response) => {
    const config = await settingsService.getThresholdConfig();
    sendSuccess(res, "Konfigurasi threshold berhasil diambil", config);
  }
);

export const updateThresholdConfig = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const config = await settingsService.updateThresholdConfig(
      req.body,
      req.user.email
    );

    sendSuccess(res, "Konfigurasi threshold berhasil diperbarui", config);
  }
);

export const resetThresholdConfig = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const config = await settingsService.resetThresholdConfig(req.user.email);
    sendSuccess(
      res,
      "Konfigurasi threshold berhasil direset ke nilai default",
      config
    );
  }
);

export const getAccessConfig = asyncHandler(
  async (_req: Request, res: Response) => {
    const config = await settingsService.getAccessConfig();
    sendSuccess(res, "Konfigurasi akses berhasil diambil", config);
  }
);

export const updateAccessConfig = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const config = await settingsService.updateAccessConfig(
      req.body,
      req.user.email
    );

    sendSuccess(res, "Konfigurasi akses berhasil diperbarui", config);
  }
);

export const getWhoDatasets = asyncHandler(
  async (_req: Request, res: Response) => {
    const datasets = await settingsService.getWhoDatasets();
    sendSuccess(res, "Dataset WHO berhasil diambil", datasets);
  }
);

export const getBootstrapStatus = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = await settingsService.getBootstrapStatus();
    sendSuccess(res, "Status bootstrap master data berhasil diambil", status);
  }
);

export const updateWhoDataset = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const dataset = await settingsService.updateWhoDataset(
      Number(req.params.id),
      {
        ...req.body,
        updatedBy: req.user.email,
      }
    );

    sendSuccess(res, "Dataset WHO berhasil diperbarui", dataset);
  }
);
