import Translation from '../models/Translation.js';
import Project from '../models/Project.js';
import { cacheService } from './cache.service.js';
import { TRANSLATION_STATUS } from '../constants/index.js';

export const getTranslationsWithFallback = async (projectId: string, language: string, environment: string, namespace?: string) => {
  // 1. Cache Check
  const cacheKey = `sdk:${projectId}:${environment}:${language}${namespace ? `:${namespace}` : ''}`;
  const cachedData = await cacheService.get(cacheKey);
  if (cachedData) return cachedData;

  // 2. Fetch Project Config
  const project = await Project.findById(projectId).lean();
  if (!project) throw new Error('Project not found');

  const defaultLang = project.defaultLanguage;
  const targetLanguages = [language];
  
  if (language.includes('-')) {
    targetLanguages.push(language.split('-')[0] as string);
  }
  if (!targetLanguages.includes(defaultLang)) {
    targetLanguages.push(defaultLang);
  }

  // 3. Optimized N+1 Query Elimination using $in
  const query: any = {
    projectId,
    environment,
    language: { $in: targetLanguages },
    isArchived: false,
    status: TRANSLATION_STATUS.APPROVED // SDK should only fetch APPROVED translations
  };
  if (namespace) query.namespace = namespace;

  const translations = await Translation.find(query).lean();

  // 4. In-memory fallback merge
  const finalResult: any = {};

  // We merge in reverse order of specificity (default -> base lang -> specific locale)
  for (const lang of targetLanguages.reverse()) {
    const langTranslations = translations.filter((t: any) => t.language === lang);
    langTranslations.forEach((t: any) => {
      finalResult[t.key] = t.value;
    });
  }

  // 5. Cache the final computed response
  await cacheService.set(cacheKey, finalResult);

  return finalResult;
};
