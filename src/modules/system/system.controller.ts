import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { UnauthorizedError, BadRequestError } from "@/utils/ApiError";
import { systemService } from "./system.service";

export const getSystemInfo = asyncHandler(
  async (_req: Request, res: Response) => {
    const info = await systemService.getInfo();
    sendSuccess(res, "Informasi sistem berhasil diambil", info);
  }
);

export const triggerSystemBackup = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const result = await systemService.triggerBackup(req.user.email);
    sendSuccess(res, "Backup database berhasil dipicu", result);
  }
);

export const getSystemLogs = asyncHandler(
  async (req: Request, res: Response) => {
    const VALID_LEVELS = new Set(["error", "warn", "info", "http", "debug"]);
    const rawLevel = req.query.level ? String(req.query.level) : undefined;

    if (rawLevel && !VALID_LEVELS.has(rawLevel)) {
      throw new BadRequestError(
        `Level tidak valid. Gunakan salah satu: error, warn, info, http, debug`
      );
    }

    const page = Math.max(1, Number.parseInt(String(req.query.page)) || 1);
    const limit = Math.min(
      200,
      Math.max(1, Number.parseInt(String(req.query.limit)) || 50)
    );

    const result = await systemService.getLogs(page, limit, rawLevel);
    sendSuccess(res, "Log sistem berhasil diambil", result.data, result.meta);
  }
);
