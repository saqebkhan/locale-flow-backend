import mongoose, { Schema, Document } from 'mongoose';

export enum ApiKeyPermission {
  READ_ONLY = 'READ_ONLY',
  ADMIN = 'ADMIN'
}


export interface IApiKey extends Document {
  keyHash: string;
  encryptedKey: string;
  projectId: mongoose.Types.ObjectId;
  name: string;
  permission: ApiKeyPermission;
  environment: string;
  lastUsedAt?: Date;
}

const ApiKeySchema: Schema = new Schema({
  keyHash: { type: String, required: true, unique: true },
  encryptedKey: { type: String, required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  permission: { type: String, enum: Object.values(ApiKeyPermission), default: ApiKeyPermission.READ_ONLY },
  environment: { type: String, default: 'DEVELOPMENT' },
  lastUsedAt: { type: Date }
}, { timestamps: true });

ApiKeySchema.index({ projectId: 1, environment: 1 }, { unique: true });

export default mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
