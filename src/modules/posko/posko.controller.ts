import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { poskoService } from "./posko.service";
import { sendSuccess, sendCreated } from "@/utils/response";
import { BadRequestError } from "@/utils/ApiError";

export const getAllPoskos = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 10;
    const search = req.query.search ? String(req.query.search) : undefined;
    const villageId = req.query.villageId
      ? parseInt(String(req.query.villageId))
      : undefined;

    const result = await poskoService.findAll(page, limit, villageId, search);
    sendSuccess(res, "Data posko berhasil diambil", result.poskos, result.meta);
  }
);

export const getPoskoById = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    const posko = await poskoService.findById(id);
    sendSuccess(res, "Data posko berhasil diambil", posko);
  }
);

export const createPosko = asyncHandler(async (req: Request, res: Response) => {
  const { name, villageId, latitude, longitude } = req.body;

  if (!name || !villageId) {
    throw new BadRequestError("Nama dan villageId wajib diisi");
  }

  const posko = await poskoService.create({
    name,
    villageId: parseInt(String(villageId)),
    latitude: latitude ? parseFloat(String(latitude)) : undefined,
    longitude: longitude ? parseFloat(String(longitude)) : undefined,
  });
  sendCreated(res, "Posko berhasil dibuat", posko);
});

export const updatePosko = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { name, villageId, latitude, longitude } = req.body;

  const posko = await poskoService.update(id, {
    name,
    villageId: villageId ? parseInt(String(villageId)) : undefined,
    latitude: latitude !== undefined ? parseFloat(String(latitude)) : undefined,
    longitude:
      longitude !== undefined ? parseFloat(String(longitude)) : undefined,
  });
  sendSuccess(res, "Posko berhasil diperbarui", posko);
});

export const deletePosko = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  await poskoService.delete(id);
  sendSuccess(res, "Posko berhasil dihapus");
});

export const getMapData = asyncHandler(async (_req: Request, res: Response) => {
  const poskos = await poskoService.getMapData();
  sendSuccess(res, "Data peta berhasil diambil", poskos);
});
