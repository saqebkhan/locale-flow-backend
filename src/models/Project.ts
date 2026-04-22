import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description?: string;
  defaultLanguage: string;
  languages: string[];
  owner: mongoose.Types.ObjectId;
}

const ProjectSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  defaultLanguage: { type: String, default: 'en' },
  languages: { type: [String], default: ['en'] },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.model<IProject>('Project', ProjectSchema);
