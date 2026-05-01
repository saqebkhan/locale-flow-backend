import mongoose, { Schema, Document } from 'mongoose';
import { TRANSLATION_STATUS, REQUEST_ACTIONS, ENVIRONMENTS, DEFAULT_NAMESPACE } from '../constants/index.js';

export interface ITranslation extends Document {
  projectId: mongoose.Types.ObjectId;
  language: string;
  namespace: string;
  key: string;
  value: string;
  environment: string;
  status: typeof TRANSLATION_STATUS[keyof typeof TRANSLATION_STATUS];
  isArchived: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  requestedBy?: mongoose.Types.ObjectId;
  requestedAction?: typeof REQUEST_ACTIONS[keyof typeof REQUEST_ACTIONS];
  previousValue?: string;
}

const TranslationSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  language: { type: String, required: true },
  namespace: { type: String, default: DEFAULT_NAMESPACE },
  key: { type: String, required: true },
  value: { type: String, required: true },
  previousValue: { type: String },
  environment: { type: String, default: ENVIRONMENTS.DEVELOPMENT },
  status: { type: String, enum: Object.values(TRANSLATION_STATUS), default: TRANSLATION_STATUS.DRAFT },
  isArchived: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  requestedAction: { type: String, enum: Object.values(REQUEST_ACTIONS) }
}, { timestamps: true });

// Index for optimized fetching
TranslationSchema.index({ projectId: 1, language: 1, namespace: 1, key: 1, environment: 1 }, { unique: true });

export default mongoose.model<ITranslation>('Translation', TranslationSchema);
