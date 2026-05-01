import mongoose, { Schema, Document } from 'mongoose';
import { ENVIRONMENTS, DEFAULT_LANGUAGE } from '../constants/index.js';

export interface IProject extends Document {
  name: string;
  description?: string;
  defaultLanguage: string;
  languages: string[];
  environments: string[];
  restrictedEnvironments: string[];
  owner: mongoose.Types.ObjectId;
}

const ProjectSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  defaultLanguage: { type: String, default: DEFAULT_LANGUAGE },
  languages: { type: [String], default: [DEFAULT_LANGUAGE] },
  environments: { type: [String], default: [ENVIRONMENTS.DEVELOPMENT] },
  restrictedEnvironments: { type: [String], default: [ENVIRONMENTS.PRODUCTION, ENVIRONMENTS.PROD] },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.model<IProject>('Project', ProjectSchema);
