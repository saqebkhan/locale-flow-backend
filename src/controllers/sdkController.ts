import { Response } from 'express';
import { ApiKeyRequest } from '../middleware/apiKeyAuth';
import { getTranslationsWithFallback } from '../services/translation.service';
import TranslationSnapshot from '../models/TranslationSnapshot';
import Project from '../models/Project';
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

  if (Array.isArray(keys)) {
    for (const key of keys) {
      try {
        await logQueue.add('reportMissing', { projectId, language: lang, key });
      } catch (err) {
        console.error('Failed to add to logQueue:', err);
        // Continue regardless of queue failure
      }
    }
  }

  res.status(202).json({ message: 'Accepted' });
};
