import mongoose, { Schema, Document } from 'mongoose';
import { ROLES, INVITATION_STATUS } from '../constants/index.js';

export interface IInvitation extends Document {
  projectId: mongoose.Types.ObjectId;
  email: string;
  role: typeof ROLES[keyof typeof ROLES];
  invitedBy: mongoose.Types.ObjectId;
  status: typeof INVITATION_STATUS[keyof typeof INVITATION_STATUS];
  token: string;
}

const InvitationSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  email: { type: String, required: true },
  role: { 
    type: String, 
    enum: Object.values(ROLES), 
    default: ROLES.EDITOR 
  },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: Object.values(INVITATION_STATUS), 
    default: INVITATION_STATUS.PENDING 
  },
  token: { type: String, required: true, unique: true }
}, { timestamps: true });

export default mongoose.model<IInvitation>('Invitation', InvitationSchema);
