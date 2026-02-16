import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import {
  measurementService,
  SyncMeasurementInput,
} from "./measurement.service";
import { sendSuccess, sendCreated } from "@/utils/response";
import { BadRequestError } from "@/utils/ApiError";
import { Posisi, Status } from "@prisma/client";
import { validateQuestionnaireResponse } from "@/constants/questionnaires";

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
    const updatedAfter =
      typeof req.query.updatedAfter === "string"
        ? new Date(req.query.updatedAfter)
        : undefined;
    const createdAfter =
      typeof req.query.createdAfter === "string"
        ? new Date(req.query.createdAfter)
        : undefined;

    const result = await measurementService.findAll(
      page,
      limit,
      {
        balitaId,
        relawanId,
        status,
        updatedAfter,
        createdAfter,
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
      notes,
      sanitationData,
      medicalHistoryData,
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

    // Validate Questionnaire Data
    if (sanitationData) {
      const validation = validateQuestionnaireResponse(
        "sanitation",
        sanitationData
      );
      if (!validation?.success) {
        throw new BadRequestError(
          `Format Data Sanitasi Invalid: ${validation?.error}`
        );
      }
    }

    if (medicalHistoryData) {
      const validation = validateQuestionnaireResponse(
        "medicalHistory",
        medicalHistoryData
      );
      if (!validation?.success) {
        throw new BadRequestError(
          `Format Data Riwayat Kesehatan Invalid: ${validation?.error}`
        );
      }
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
      notes,
      sanitationData,
      medicalHistoryData,
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

    // Validate Questionnaire Data for Sync
    for (const m of measurements) {
      if (m.sanitationData) {
        const validation = validateQuestionnaireResponse(
          "sanitation",
          m.sanitationData
        );
        if (!validation?.success) {
          throw new BadRequestError(
            `Sync Failed: Format Data Sanitasi Invalid for localId ${m.localId}`
          );
        }
      }
      if (m.medicalHistoryData) {
        const validation = validateQuestionnaireResponse(
          "medicalHistory",
          m.medicalHistoryData
        );
        if (!validation?.success) {
          throw new BadRequestError(
            `Sync Failed: Format Data Riwayat Kesehatan Invalid for localId ${m.localId}`
          );
        }
      }
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

export const getPublicMeasurement = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await measurementService.getPublicInfo(
      String(req.params.id)
    );
    sendSuccess(res, "Data publik berhasil diambil", result);
  }
);

export const accessMeasurement = asyncHandler(
  async (req: Request, res: Response) => {
    const { dob } = req.body;
    if (!dob) {
      throw new BadRequestError("Tanggal lahir wajib diisi");
    }

    const result = await measurementService.verifyAccess(
      String(req.params.id),
      dob
    );
    sendSuccess(res, "Akses berhasil diverifikasi", result.data);
  }
);
