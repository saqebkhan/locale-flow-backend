import Translation from '../models/Translation';
import Project from '../models/Project';

const mapEnvironment = (env: string): string => {
  const map: Record<string, string> = {
    'DEVELOPMENT': 'DEV',
    'STAGING': 'TEST',
    'PRODUCTION': 'PROD'
  };
  return map[env] || env;
};

export const getTranslations = async (projectId: string, language: string, environment: string, namespace?: string) => {
  const normalizedEnv = mapEnvironment(environment);
  const query: any = { projectId, language, environment: normalizedEnv };
  if (namespace) query.namespace = namespace;

  const translations = await Translation.find(query);
  const result: any = {};
  
  translations.forEach(t => {
    result[t.key] = t.value;
  });

  return result;
};

export const getTranslationsWithFallback = async (projectId: string, language: string, environment: string, namespace?: string) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  const defaultLang = project.defaultLanguage;
  const languages = [language];
  
  // hi-IN -> hi -> en
  if (language.includes('-')) {
    languages.push(language.split('-')[0]);
  }
  if (!languages.includes(defaultLang)) {
    languages.push(defaultLang);
  }

  const finalResult: any = {};

  for (const lang of languages.reverse()) {
    const translations = await getTranslations(projectId, lang, environment, namespace);
    Object.assign(finalResult, translations);
  }

  return finalResult;
};
