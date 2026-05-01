import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export const timingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    logger.info(`[API TIMING] ${req.method} ${req.originalUrl} - ${timeInMs}ms`);
  });
  next();
};
