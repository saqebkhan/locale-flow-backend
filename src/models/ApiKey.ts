import mongoose, { Schema, Document } from 'mongoose';
import { API_KEY_PERMISSIONS, ENVIRONMENTS } from '../constants/index.js';

export type ApiKeyPermission = typeof API_KEY_PERMISSIONS[keyof typeof API_KEY_PERMISSIONS];
export type ApiKeyEnvironment = string;

export interface IApiKey extends Document {
  keyHash: string;
  encryptedKey: string;
  projectId: mongoose.Types.ObjectId;
  name: string;
  permission: ApiKeyPermission;
  environment: ApiKeyEnvironment;
  lastUsedAt?: Date;
}

const ApiKeySchema: Schema = new Schema({
  keyHash: { type: String, required: true, unique: true },
  encryptedKey: { type: String, required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  permission: { type: String, enum: Object.values(API_KEY_PERMISSIONS), default: API_KEY_PERMISSIONS.READ_ONLY },
  environment: { type: String, default: ENVIRONMENTS.DEVELOPMENT },
  lastUsedAt: { type: Date }
}, { timestamps: true });

ApiKeySchema.index({ projectId: 1, environment: 1 }, { unique: true });

export default mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
