import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError, ForbiddenError } from "../utils/ApiError";
import { JwtPayload } from "../types";
import { Role } from "@prisma/client";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    // Check for token in Authorization header first
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const headerToken = authHeader.split(" ")[1];
      // Only use header token if it's not 'undefined' or empty string
      if (
        headerToken &&
        headerToken !== "undefined" &&
        headerToken !== "null"
      ) {
        token = headerToken;
      }
    }

    // Fall back to cookie if no valid header token
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new UnauthorizedError("Access token required");
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError("Invalid or expired token"));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Not authenticated"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }

    next();
  };
};
