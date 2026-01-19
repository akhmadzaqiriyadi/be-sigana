import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof ApiError) {
    logger.warn(`API Error: ${err.message}`, { statusCode: err.statusCode });
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    logger.error(`Prisma Error: ${err.message}`);
    res.status(400).json({
      success: false,
      message: 'Database error occurred',
      ...(env.NODE_ENV === 'development' && { error: err.message }),
    });
    return;
  }

  // Default error
  logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    ...(env.NODE_ENV === 'development' && { 
      error: err.message,
      stack: err.stack 
    }),
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};
