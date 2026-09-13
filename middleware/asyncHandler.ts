import { Request, Response, NextFunction } from 'express';

// asyncHandler wraps async functions to catch errors and pass them to the Express error handler
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
