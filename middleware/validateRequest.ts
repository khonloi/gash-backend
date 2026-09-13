import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { errorResponse } from '../utils/apiResponse.js';

export const validateRequest = (schema: ZodType<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors
        const issues = (error.issues || []) as any[];
        const formattedErrors = issues.map((err: any) => ({
          path: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
          message: err.message,
        }));
        return errorResponse(res, 400, 'Validation failed', formattedErrors);
      }
      return errorResponse(res, 400, 'Invalid request data');
    }
  };
};

