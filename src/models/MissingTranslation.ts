import mongoose, { Schema, Document } from 'mongoose';

export interface IMissingTranslation extends Document {
  projectId: mongoose.Types.ObjectId;
  language: string;
  key: string;
  count: number;
  lastSeenAt: Date;
}

const MissingTranslationSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  language: { type: String, required: true },
  key: { type: String, required: true },
  count: { type: Number, default: 1 },
  lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });

MissingTranslationSchema.index({ projectId: 1, language: 1, key: 1 }, { unique: true });

export default mongoose.model<IMissingTranslation>('MissingTranslation', MissingTranslationSchema);
