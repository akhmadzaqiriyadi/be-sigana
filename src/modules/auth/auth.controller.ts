import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authService } from './auth.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { BadRequestError } from '../../utils/ApiError';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    throw new BadRequestError('Email, password, and name are required');
  }

  const user = await authService.register({ email, password, name });
  sendCreated(res, 'Registration successful. Please wait for admin approval.', user);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError('Email and password are required');
  }

  const result = await authService.login({ email, password });
  sendSuccess(res, 'Login successful', result);
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = await authService.getProfile(userId);
  sendSuccess(res, 'Profile retrieved successfully', user);
});
