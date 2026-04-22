import mongoose, { Schema, Document } from 'mongoose';

export interface IProjectMember extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
}

const ProjectMemberSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { 
    type: String, 
    enum: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'], 
    default: 'EDITOR' 
  }
}, { timestamps: true });

// Ensure a user can only have one role per project
ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IProjectMember>('ProjectMember', ProjectMemberSchema);
