import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { villageService } from "./village.service";
import { sendSuccess, sendCreated } from "@/utils/response";

export const getAllVillages = asyncHandler(
  async (req: Request, res: Response) => {
    // FE Report dropdown: ?type=kecamatan → distinct kecamatan list
    if (req.query.type === "kecamatan") {
      const search = req.query.search ? String(req.query.search) : undefined;
      const data = await villageService.findDistinctKecamatan(search);
      return sendSuccess(res, "Data kecamatan berhasil diambil", data);
    }

    // FE Report dropdown: ?kecamatan=... → list desa in that kecamatan
    if (req.query.kecamatan) {
      const data = await villageService.findByKecamatan(
        String(req.query.kecamatan)
      );
      return sendSuccess(res, "Data desa berhasil diambil", data);
    }

    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await villageService.findAll(page, limit, search);
    return sendSuccess(
      res,
      "Data desa berhasil diambil",
      result.villages,
      result.meta
    );
  }
);

export const getVillageById = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    const village = await villageService.findById(id);
    sendSuccess(res, "Data desa berhasil diambil", village);
  }
);

export const createVillage = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, districts, latitude, longitude, isActive } = req.body;

    const village = await villageService.create({
      name,
      districts,
      latitude,
      longitude,
      isActive,
    });
    sendCreated(res, "Desa berhasil dibuat", village);
  }
);

export const updateVillage = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    const { name, districts, latitude, longitude, isActive } = req.body;

    const village = await villageService.update(id, {
      name,
      districts,
      latitude,
      longitude,
      isActive,
    });
    sendSuccess(res, "Desa berhasil diperbarui", village);
  }
);

export const deleteVillage = asyncHandler(
  async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id));
    await villageService.delete(id);
    sendSuccess(res, "Desa berhasil dihapus");
  }
);
