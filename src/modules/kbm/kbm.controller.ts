import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { UnauthorizedError } from "@/utils/ApiError";
import { kbmService } from "./kbm.service";

export const getKbmReferences = asyncHandler(
  async (_req: Request, res: Response) => {
    const references = await kbmService.findAll();
    sendSuccess(res, "Referensi KBM berhasil diambil", references);
  }
);

export const updateKbmReference = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const id = Number(req.params.id);
    const { kbmMinimal } = req.body;

    const reference = await kbmService.update(id, {
      kbmMinimal,
      updatedBy: req.user.email,
    });

    sendSuccess(res, "Referensi KBM berhasil diperbarui", reference);
  }
);
