import { Request, Response, NextFunction } from 'express';

export const setCacheHeaders = (seconds: number) => (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds / 2}`);
  }
  next();
};
