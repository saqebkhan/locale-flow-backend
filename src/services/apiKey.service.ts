import crypto from 'crypto';
import ApiKey, { ApiKeyPermission, ApiKeyEnvironment } from '../models/ApiKey';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'v-p-p-s-e-c-r-e-t-k-e-y-3-2-chars';
const IV_LENGTH = 16;

// We hash the key to ensure it's always exactly 32 bytes for aes-256-cbc
const keyBuffer = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}


export const generateApiKey = async (projectId: string, name: string, permission: ApiKeyPermission, environment: ApiKeyEnvironment) => {
  const rawKey = `tp_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey + (process.env.API_KEY_SALT || '')).digest('hex');
  const encryptedKey = encrypt(rawKey);

  const apiKey = await ApiKey.create({
    keyHash,
    encryptedKey,
    projectId,
    name,
    permission,
    environment
  });

  return { rawKey, apiKey };
};

export const rotateApiKey = async (keyId: string) => {
  const apiKey = await ApiKey.findById(keyId);
  if (!apiKey) throw new Error('API Key not found');

  const rawKey = `tp_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey + (process.env.API_KEY_SALT || '')).digest('hex');
  const encryptedKey = encrypt(rawKey);

  // Update the existing record
  apiKey.keyHash = keyHash;
  apiKey.encryptedKey = encryptedKey;
  apiKey.name = apiKey.name.includes('(Rotated)') ? apiKey.name : `${apiKey.name} (Rotated)`;
  await apiKey.save();

  return { rawKey, apiKey };
};
