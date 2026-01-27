export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Permintaan tidak valid") {
    super(400, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Belum terautentikasi") {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Akses ditolak") {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Tidak Ditemukan") {
    super(404, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Konflik data") {
    super(409, message);
  }
}
