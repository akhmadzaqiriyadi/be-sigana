import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { villageService } from './village.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { BadRequestError } from '../../utils/ApiError';

export const getAllVillages = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 10;
  const search = req.query.search ? String(req.query.search) : undefined;

  const result = await villageService.findAll(page, limit, search);
  sendSuccess(res, 'Villages retrieved successfully', result.villages, result.meta);
});

export const getVillageById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const village = await villageService.findById(id);
  sendSuccess(res, 'Village retrieved successfully', village);
});

export const createVillage = asyncHandler(async (req: Request, res: Response) => {
  const { name, districts } = req.body;

  if (!name || !districts) {
    throw new BadRequestError('Name and districts are required');
  }

  const village = await villageService.create({ name, districts });
  sendCreated(res, 'Village created successfully', village);
});

export const updateVillage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { name, districts } = req.body;

  const village = await villageService.update(id, { name, districts });
  sendSuccess(res, 'Village updated successfully', village);
});

export const deleteVillage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  await villageService.delete(id);
  sendSuccess(res, 'Village deleted successfully');
});
