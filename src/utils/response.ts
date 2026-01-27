import { Response } from "express";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
  meta?: ApiResponse["meta"]
): Response<ApiResponse<T>> => {
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
    meta,
  });
};

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  meta?: ApiResponse["meta"]
): Response<ApiResponse<T>> => {
  return sendResponse(res, 200, message, data, meta);
};

export const sendCreated = <T>(
  res: Response,
  message: string,
  data?: T
): Response<ApiResponse<T>> => {
  return sendResponse(res, 201, message, data);
};
