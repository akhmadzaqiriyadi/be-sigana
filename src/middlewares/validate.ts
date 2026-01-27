import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";
import { ApiError } from "../utils/ApiError";

export const validate =
  (schema: ZodType) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.issues
          .map((detail) => `${detail.path.join(".")}: ${detail.message}`)
          .join(", ");
        return next(new ApiError(400, errorMessage));
      }
      return next(error);
    }
  };
