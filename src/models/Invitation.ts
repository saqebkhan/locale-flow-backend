import mongoose, { Schema, Document } from 'mongoose';

export interface IInvitation extends Document {
  projectId: mongoose.Types.ObjectId;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  invitedBy: mongoose.Types.ObjectId;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  token: string;
}

const InvitationSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  email: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['ADMIN', 'EDITOR', 'VIEWER'], 
    default: 'EDITOR' 
  },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'ACCEPTED', 'REJECTED'], 
    default: 'PENDING' 
  },
  token: { type: String, required: true, unique: true }
}, { timestamps: true });

export default mongoose.model<IInvitation>('Invitation', InvitationSchema);
