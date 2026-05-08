import { Response } from 'express';
import { ApiKeyRequest } from '../middleware/apiKeyAuth.js';
import { getTranslationsWithFallback } from '../services/translation.service.js';
import TranslationSnapshot from '../models/TranslationSnapshot.js';
import Project from '../models/Project.js';
import { logQueue } from '../queues/logQueue.js';
import MissingTranslation from '../models/MissingTranslation.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_LANGUAGE } from '../constants/index.js';

export const fetchTranslations = async (req: ApiKeyRequest, res: Response) => {
  const { lang, namespace, version } = req.query;
  const projectId = req.apiKey.projectId;

  if (version) {
    const snapshot = await TranslationSnapshot.findOne({ projectId, version: version as string });
    if (snapshot) {
      return res.json(snapshot.data);
    }
  }

  try {
    const translations = await getTranslationsWithFallback(
      projectId.toString(),
      (lang as string) || DEFAULT_LANGUAGE,
      req.apiKey.environment,
      namespace as string
    );
    res.json(translations);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectConfig = async (req: ApiKeyRequest, res: Response) => {
  const { projectId } = req.apiKey;
  const project = await Project.findById(projectId).select('name languages defaultLanguage');
  if (!project) return res.status(404).json({ message: 'Project not found' });
  res.json(project);
};

export const reportMissingKeys = async (req: ApiKeyRequest, res: Response) => {
  const { lang, keys } = req.body;
  const projectId = req.apiKey.projectId;

  console.log(`[SDK] Missing Key Report received for Project: ${projectId}`);
  console.log(`[SDK] Keys to report: ${JSON.stringify(keys)}`);

  if (Array.isArray(keys)) {
    for (const key of keys) {
      try {
        console.log(`[SDK] Attempting to queue/save key: ${key}`);
        // Try background queue first for performance
        await logQueue.add('reportMissing', { projectId, language: lang, key }, {
          attempts: 1,
          removeOnComplete: true
        });
      } catch (err) {
        // FALLBACK: Direct Save if Redis is down (Common in local dev)
        console.log(`[SDK] Queue failed, falling back to direct save for: ${key}`);
        try {
          const result = await MissingTranslation.findOneAndUpdate(
            { projectId, language: lang || DEFAULT_LANGUAGE, key },
            { $inc: { count: 1 }, lastSeenAt: new Date() },
            { upsert: true, new: true }
          );
          console.log(`[SDK] Direct save successful: ${result?.key} (Count: ${result?.count})`);
        } catch (dbErr) {
          console.error('[SDK] Failed to save missing key even with direct fallback:', dbErr);
        }
      }
    }
  }

  res.status(202).json({ message: 'Accepted' });
};
