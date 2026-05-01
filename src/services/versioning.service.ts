import Translation from '../models/Translation.js';
import TranslationSnapshot from '../models/TranslationSnapshot.js';

export const createSnapshot = async (projectId: string, version: string, userId: string) => {
  // Fetch all translations for the project
  const translations = await Translation.find({ projectId });
  
  // Group by language and namespace
  const data: any = {};
  translations.forEach((t: any) => {
    if (!data[t.language]) data[t.language] = {};
    if (!data[t.language][t.namespace]) data[t.language][t.namespace] = {};
    data[t.language][t.namespace][t.key] = t.value;
  });

  const snapshot = await TranslationSnapshot.create({
    projectId,
    version,
    data,
    createdBy: userId
  });

  return snapshot;
};

export const rollbackToVersion = async (projectId: string, version: string, userId: string) => {
  const snapshot = await TranslationSnapshot.findOne({ projectId, version });
  if (!snapshot) throw new Error('Snapshot not found');

  // Delete current translations and replace with snapshot data
  await Translation.deleteMany({ projectId });

  const translationsToInsert: any[] = [];
  
  for (const [lang, namespaces] of Object.entries(snapshot.data)) {
    for (const [ns, keys] of Object.entries(namespaces as any)) {
      for (const [key, value] of Object.entries(keys as any)) {
        translationsToInsert.push({
          projectId,
          language: lang,
          namespace: ns,
          key,
          value,
          createdBy: userId,
          updatedBy: userId
        });
      }
    }
  }

  await Translation.insertMany(translationsToInsert);
  return { message: 'Rollback successful' };
};
