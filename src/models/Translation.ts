import mongoose, { Schema, Document } from 'mongoose';

export interface ITranslation extends Document {
  projectId: mongoose.Types.ObjectId;
  language: string;
  namespace: string;
  key: string;
  value: string;
  environment: 'DEV' | 'TEST' | 'PROD';
  status: 'DRAFT' | 'AI_SUGGESTED' | 'PENDING_APPROVAL' | 'APPROVED';
  isArchived: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
}

const TranslationSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  language: { type: String, required: true },
  namespace: { type: String, default: 'common' },
  key: { type: String, required: true },
  value: { type: String, required: true },
  environment: { type: String, enum: ['DEV', 'TEST', 'PROD'], default: 'DEV' },
  status: { type: String, enum: ['DRAFT', 'AI_SUGGESTED', 'PENDING_APPROVAL', 'APPROVED'], default: 'DRAFT' },
  isArchived: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Index for optimized fetching
TranslationSchema.index({ projectId: 1, language: 1, namespace: 1, key: 1, environment: 1 }, { unique: true });

export default mongoose.model<ITranslation>('Translation', TranslationSchema);
