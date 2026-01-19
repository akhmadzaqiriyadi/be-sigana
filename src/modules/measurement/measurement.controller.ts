import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { measurementService, SyncMeasurementInput } from './measurement.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { BadRequestError } from '../../utils/ApiError';
import { Posisi, Status } from '@prisma/client';

export const getAllMeasurements = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 10;
  const balitaId = req.query.balitaId ? String(req.query.balitaId) : undefined;
  const relawanId = req.query.relawanId ? String(req.query.relawanId) : undefined;
  const status = req.query.status ? (String(req.query.status) as Status) : undefined;

  const result = await measurementService.findAll(page, limit, { balitaId, relawanId, status });
  sendSuccess(res, 'Measurements retrieved successfully', result.measurements, result.meta);
});

export const getMeasurementById = asyncHandler(async (req: Request, res: Response) => {
  const measurement = await measurementService.findById(String(req.params.id));
  sendSuccess(res, 'Measurement retrieved successfully', measurement);
});

export const createMeasurement = asyncHandler(async (req: Request, res: Response) => {
  const {
    balitaId,
    beratBadan,
    tinggiBadan,
    lingkarKepala,
    lila,
    posisiUkur,
    localId,
  } = req.body;

  if (!balitaId || !beratBadan || !tinggiBadan || !lingkarKepala || !lila || !posisiUkur) {
    throw new BadRequestError('balitaId, beratBadan, tinggiBadan, lingkarKepala, lila, and posisiUkur are required');
  }

  if (!['TERLENTANG', 'BERDIRI'].includes(posisiUkur)) {
    throw new BadRequestError('posisiUkur must be TERLENTANG or BERDIRI');
  }

  const measurement = await measurementService.create({
    balitaId,
    relawanId: req.user!.userId,
    beratBadan: parseFloat(String(beratBadan)),
    tinggiBadan: parseFloat(String(tinggiBadan)),
    lingkarKepala: parseFloat(String(lingkarKepala)),
    lila: parseFloat(String(lila)),
    posisiUkur: posisiUkur as Posisi,
    localId,
  });

  sendCreated(res, 'Measurement created successfully', measurement);
});

export const syncMeasurements = asyncHandler(async (req: Request, res: Response) => {
  const { measurements } = req.body;

  if (!measurements || !Array.isArray(measurements)) {
    throw new BadRequestError('measurements array is required');
  }

  // Add relawanId to each measurement
  const measurementsWithRelawan: SyncMeasurementInput[] = measurements.map((m: Partial<SyncMeasurementInput>) => ({
    ...m,
    relawanId: req.user!.userId,
  } as SyncMeasurementInput));

  const results = await measurementService.syncFromOffline(measurementsWithRelawan);
  sendSuccess(res, 'Measurements synced successfully', results);
});

export const getStatistics = asyncHandler(async (_req: Request, res: Response) => {
  const statistics = await measurementService.getStatistics();
  sendSuccess(res, 'Statistics retrieved successfully', statistics);
});

export const deleteMeasurement = asyncHandler(async (req: Request, res: Response) => {
  await measurementService.delete(String(req.params.id));
  sendSuccess(res, 'Measurement deleted successfully');
});
