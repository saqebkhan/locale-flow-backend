import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import ApiKey from '../models/ApiKey';

export interface ApiKeyRequest extends Request {
  apiKey?: any;
}

export const apiKeyProtect = async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  const key = req.headers['x-api-key'] as string;
  if (!key) {
    return res.status(401).json({ message: 'API Key is missing' });
  }

  const keyHash = crypto.createHash('sha256').update(key + (process.env.API_KEY_SALT || '')).digest('hex');
  
  const apiKey = await ApiKey.findOne({ keyHash });
  if (!apiKey) {
    return res.status(401).json({ message: 'Invalid API Key' });
  }

  apiKey.lastUsedAt = new Date();
  await apiKey.save();

  req.apiKey = apiKey;
  next();
};
