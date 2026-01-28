import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import {
  measurementService,
  SyncMeasurementInput,
} from "./measurement.service";
import { sendSuccess, sendCreated } from "@/utils/response";
import { BadRequestError } from "@/utils/ApiError";
import { Posisi, Status } from "@prisma/client";

export const getAllMeasurements = asyncHandler(
  async (req: Request, res: Response) => {
    const page =
      typeof req.query.page === "string" ? Number.parseInt(req.query.page) : 1;
    const limit =
      typeof req.query.limit === "string"
        ? Number.parseInt(req.query.limit)
        : 10;
    const balitaId =
      typeof req.query.balitaId === "string" ? req.query.balitaId : undefined;
    const relawanId =
      typeof req.query.relawanId === "string" ? req.query.relawanId : undefined;
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as Status)
        : undefined;

    const result = await measurementService.findAll(
      page,
      limit,
      {
        balitaId,
        relawanId,
        status,
      },
      req.user as { role: string; userId: string }
    );
    sendSuccess(
      res,
      "Data pengukuran berhasil diambil",
      result.measurements,
      result.meta
    );
  }
);

export const getMeasurementById = asyncHandler(
  async (req: Request, res: Response) => {
    const measurement = await measurementService.findById(
      String(req.params.id)
    );
    sendSuccess(res, "Data pengukuran berhasil diambil", measurement);
  }
);

export const createMeasurement = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      balitaId,
      beratBadan,
      tinggiBadan,
      lingkarKepala,
      lila,
      posisiUkur,
      localId,
    } = req.body;

    if (
      !balitaId ||
      !beratBadan ||
      !tinggiBadan ||
      !lingkarKepala ||
      !lila ||
      !posisiUkur
    ) {
      throw new BadRequestError(
        "balitaId, beratBadan, tinggiBadan, lingkarKepala, lila, dan posisiUkur wajib diisi"
      );
    }

    if (!["TERLENTANG", "BERDIRI"].includes(posisiUkur)) {
      throw new BadRequestError("posisiUkur harus TERLENTANG atau BERDIRI");
    }

    const measurement = await measurementService.create({
      balitaId,
      relawanId: req.user!.userId,
      beratBadan: Number.parseFloat(String(beratBadan)),
      tinggiBadan: Number.parseFloat(String(tinggiBadan)),
      lingkarKepala: Number.parseFloat(String(lingkarKepala)),
      lila: Number.parseFloat(String(lila)),
      posisiUkur: posisiUkur as Posisi,
      localId,
    });

    sendCreated(res, "Data pengukuran berhasil dibuat", measurement);
  }
);

export const syncMeasurements = asyncHandler(
  async (req: Request, res: Response) => {
    const { measurements } = req.body;

    if (!measurements || !Array.isArray(measurements)) {
      throw new BadRequestError("array measurements wajib diisi");
    }

    // Add relawanId to each measurement
    const measurementsWithRelawan: SyncMeasurementInput[] = measurements.map(
      (m: Partial<SyncMeasurementInput>) =>
        ({
          ...m,
          relawanId: req.user!.userId,
        }) as SyncMeasurementInput
    );

    const results = await measurementService.syncFromOffline(
      measurementsWithRelawan
    );
    sendSuccess(res, "Data pengukuran berhasil disinkronisasi", results);
  }
);

export const syncPull = asyncHandler(async (req: Request, res: Response) => {
  const lastSync = new Date(req.query.lastSync as string);
  const relawanId = req.user!.role === "RELAWAN" ? req.user!.userId : undefined;

  const results = await measurementService.getDeltaSync(lastSync, relawanId);
  sendSuccess(res, "Data downstream berhasil diambil", results);
});

export const getStatistics = asyncHandler(
  async (_req: Request, res: Response) => {
    const statistics = await measurementService.getStatistics();
    sendSuccess(res, "Statistik berhasil diambil", statistics);
  }
);

export const deleteMeasurement = asyncHandler(
  async (req: Request, res: Response) => {
    await measurementService.delete(String(req.params.id));
    sendSuccess(res, "Data pengukuran berhasil dihapus");
  }
);
