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
  
  // Set token in httpOnly cookie for credentials-based auth
  const cookieOptions = {
    httpOnly: true,
    // Secure is required for SameSite=None. 
    // Localhost is treated as secure context by browsers, so this works on dev too.
    secure: true, 
    sameSite: 'none' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  
  res.cookie('token', result.token, cookieOptions);
  
  sendSuccess(res, 'Login successful', result);
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = await authService.getProfile(userId);
  sendSuccess(res, 'Profile retrieved successfully', user);
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  // Clear the token cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
  
  // For JWT-based auth, logout is handled client-side by removing the token
  // This endpoint clears the cookie and allows for future extensions (e.g., token blacklisting)
  sendSuccess(res, 'Logout successful', null);
});
