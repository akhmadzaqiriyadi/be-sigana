import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

export const validate =
  (schema: ZodSchema) =>
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
        // Fix TS error: Property 'errors' does not exist on type 'ZodError<unknown>'
        // We cast to any to safely access the properties across different Zod versions
        const zodError = error as any; 
        const issues = zodError.errors || zodError.issues || [];
        
        const errorMessage = issues
          .map((detail: any) => `${detail.path.join('.')}: ${detail.message}`)
          .join(', ');
        return next(new ApiError(400, errorMessage));
      }
      return next(error);
    }
  };
