import mongoose, { Schema, Document } from 'mongoose';
import { ROLES } from '../constants/index.js';

export interface IProjectMember extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: typeof ROLES[keyof typeof ROLES];
}

const ProjectMemberSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { 
    type: String, 
    enum: Object.values(ROLES), 
    default: ROLES.EDITOR 
  }
}, { timestamps: true });

// Ensure a user can only have one role per project
ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IProjectMember>('ProjectMember', ProjectMemberSchema);
