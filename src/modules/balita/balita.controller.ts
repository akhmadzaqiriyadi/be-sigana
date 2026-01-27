import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { balitaService } from "./balita.service";
import { sendSuccess, sendCreated } from "../../utils/response";
import { BadRequestError } from "../../utils/ApiError";
import { Gender } from "@prisma/client";

export const getAllBalitas = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 10;
    const villageId = req.query.villageId
      ? parseInt(String(req.query.villageId))
      : undefined;
    const poskoId = req.query.poskoId
      ? parseInt(String(req.query.poskoId))
      : undefined;

    const result = await balitaService.findAll(page, limit, {
      villageId,
      poskoId,
    });
    sendSuccess(
      res,
      "Balitas retrieved successfully",
      result.balitas,
      result.meta
    );
  }
);

export const getBalitaById = asyncHandler(
  async (req: Request, res: Response) => {
    const balita = await balitaService.findById(String(req.params.id));
    sendSuccess(res, "Balita retrieved successfully", balita);
  }
);

export const createBalita = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      namaAnak,
      namaOrtu,
      tanggalLahir,
      jenisKelamin,
      villageId,
      poskoId,
    } = req.body;

    if (
      !namaAnak ||
      !namaOrtu ||
      !tanggalLahir ||
      !jenisKelamin ||
      !villageId
    ) {
      throw new BadRequestError(
        "namaAnak, namaOrtu, tanggalLahir, jenisKelamin, and villageId are required"
      );
    }

    if (!["L", "P"].includes(jenisKelamin)) {
      throw new BadRequestError("jenisKelamin must be L or P");
    }

    const balita = await balitaService.create({
      namaAnak,
      namaOrtu,
      tanggalLahir: new Date(tanggalLahir),
      jenisKelamin: jenisKelamin as Gender,
      villageId: parseInt(String(villageId)),
      poskoId: poskoId ? parseInt(String(poskoId)) : undefined,
    });
    sendCreated(res, "Balita created successfully", balita);
  }
);

export const updateBalita = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      namaAnak,
      namaOrtu,
      tanggalLahir,
      jenisKelamin,
      villageId,
      poskoId,
    } = req.body;

    const balita = await balitaService.update(String(req.params.id), {
      namaAnak,
      namaOrtu,
      tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : undefined,
      jenisKelamin: jenisKelamin as Gender | undefined,
      villageId: villageId ? parseInt(String(villageId)) : undefined,
      poskoId: poskoId ? parseInt(String(poskoId)) : undefined,
    });
    sendSuccess(res, "Balita updated successfully", balita);
  }
);

export const deleteBalita = asyncHandler(
  async (req: Request, res: Response) => {
    await balitaService.delete(String(req.params.id));
    sendSuccess(res, "Balita deleted successfully");
  }
);
