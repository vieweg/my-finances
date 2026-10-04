import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  if (err.statusCode && err.statusCode === 500) console.error(err);
  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal Server Error',
  });
};
