import crypto from 'crypto';
import ApiKey, { ApiKeyPermission, ApiKeyEnvironment } from '../models/ApiKey';

export const generateApiKey = async (projectId: string, name: string, permission: ApiKeyPermission, environment: ApiKeyEnvironment) => {
  const rawKey = `tp_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey + (process.env.API_KEY_SALT || '')).digest('hex');

  const apiKey = await ApiKey.create({
    keyHash,
    projectId,
    name,
    permission,
    environment
  });

  return { rawKey, apiKey };
};

export const rotateApiKey = async (oldKeyId: string) => {
  const oldApiKey = await ApiKey.findById(oldKeyId);
  if (!oldApiKey) throw new Error('API Key not found');

  const { rawKey, apiKey } = await generateApiKey(
    oldApiKey.projectId.toString(),
    `${oldApiKey.name} (Rotated)`,
    oldApiKey.permission,
    oldApiKey.environment
  );

  await ApiKey.findByIdAndDelete(oldKeyId);
  return { rawKey, apiKey };
};
