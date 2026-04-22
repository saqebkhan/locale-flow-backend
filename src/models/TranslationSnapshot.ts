import mongoose, { Schema, Document } from 'mongoose';

export interface ITranslationSnapshot extends Document {
  projectId: mongoose.Types.ObjectId;
  version: string;
  data: any; // Optimized JSON map
  createdBy: mongoose.Types.ObjectId;
}

const TranslationSnapshotSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  version: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

TranslationSnapshotSchema.index({ projectId: 1, version: 1 }, { unique: true });

export default mongoose.model<ITranslationSnapshot>('TranslationSnapshot', TranslationSnapshotSchema);
