import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { userService } from './user.service';
import { sendSuccess } from '../../utils/response';

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 10;

  const result = await userService.findAll(page, limit);
  sendSuccess(res, 'Users retrieved successfully', result.users, result.meta);
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.findById(String(req.params.id));
  sendSuccess(res, 'User retrieved successfully', user);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, role, isVerified } = req.body;
  const user = await userService.update(String(req.params.id), { name, role, isVerified });
  sendSuccess(res, 'User updated successfully', user);
});

export const verifyUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.verifyUser(String(req.params.id));
  sendSuccess(res, 'User verified successfully', user);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.delete(String(req.params.id));
  sendSuccess(res, 'User deleted successfully');
});

export const getPendingUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userService.getPendingUsers();
  sendSuccess(res, 'Pending users retrieved successfully', users);
});
