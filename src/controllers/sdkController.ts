import { Response } from 'express';
import { ApiKeyRequest } from '../middleware/apiKeyAuth';
import { getTranslationsWithFallback } from '../services/translation.service';
import TranslationSnapshot from '../models/TranslationSnapshot';
import { logQueue } from '../queues/logQueue';

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
      (lang as string) || 'en',
      namespace as string
    );
    res.json(translations);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const reportMissingKeys = async (req: ApiKeyRequest, res: Response) => {
  const { lang, keys } = req.body;
  const projectId = req.apiKey.projectId;

  if (Array.isArray(keys)) {
    for (const key of keys) {
      await logQueue.add('reportMissing', { projectId, language: lang, key });
    }
  }

  res.status(202).json({ message: 'Accepted' });
};
