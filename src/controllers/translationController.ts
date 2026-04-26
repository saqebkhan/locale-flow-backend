import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Translation from '../models/Translation';
import Project from '../models/Project';
import ProjectMember from '../models/ProjectMember';
import User from '../models/User';
import { createSnapshot, rollbackToVersion } from '../services/versioning.service';
import { translateText } from '../services/ai.service';
import { sendApprovalEmail } from '../services/email.service';

export const createTranslation = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, language, namespace, key, value, environment = 'DEV', status: providedStatus } = req.body;
    
    if (!projectId || !key || !language) {
      return res.status(400).json({ message: 'Project ID, Key, and Language are required' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized: No user found' });
    }

    // RBAC Check
    let membership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
    const project = await Project.findById(projectId);
    
    if (!membership && project?.owner?.toString() === req.user!._id.toString()) {
      membership = { role: 'OWNER' } as any;
    }

    if (!membership) return res.status(403).json({ message: 'Forbidden: You do not have access to this project' });

    // 1. VIEWER Restriction
    if (membership.role === 'VIEWER') {
      return res.status(403).json({ message: 'Viewers cannot modify translations' });
    }

    // 2. PROD Governance for EDITOR
    let status = providedStatus || 'APPROVED';
    let requestedBy = undefined;
    let requestedAction = undefined;

    if (environment === 'PROD' && (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      status = 'PENDING_APPROVAL';
      requestedBy = req.user!._id;
      requestedAction = 'CREATE';
    }

    const translation = await Translation.findOneAndUpdate(
      { projectId, language, namespace, key, environment },
      { value, status, updatedBy: req.user!._id, isArchived: false, requestedBy, requestedAction },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (!translation.createdBy) {
      translation.createdBy = req.user!._id;
      await translation.save();
    }

    // Handle Approval Email (Non-blocking)
    if (status === 'PENDING_APPROVAL' && project) {
      try {
        const ownerUser = await User.findById(project.owner);
        if (ownerUser?.email) {
          sendApprovalEmail(ownerUser.email, project, translation).catch(e => console.error('Email failed:', e));
        }
      } catch (e) {
        console.error('Failed to trigger approval email:', e);
      }
    }

    await translation.populate('requestedBy', 'name email');

    return res.status(201).json(translation);
  } catch (error: any) {
    console.error('Create Translation Error:', error);
    return res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const getTranslationsForProject = async (req: AuthRequest, res: Response) => {
  const { environment = 'DEV' } = req.query;
  const translations = await Translation.find({ 
    projectId: req.params.projectId,
    environment,
    isArchived: false
  }).populate('requestedBy', 'name email');
  res.json(translations);
};

export const deleteTranslation = async (req: AuthRequest, res: Response) => {
  const translation = await Translation.findById(req.params.id);
  if (!translation) return res.status(404).json({ message: 'Not found' });

  const membership = await ProjectMember.findOne({ projectId: translation.projectId, userId: req.user!._id });
  if (!membership || membership.role === 'VIEWER') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Editors cannot delete PROD translations directly, but can request it
  if (translation.environment === 'PROD' && (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    const updated = await Translation.findByIdAndUpdate(req.params.id, { 
      status: 'PENDING_APPROVAL', 
      requestedBy: req.user!._id, 
      requestedAction: 'DELETE' 
    }, { new: true }).populate('requestedBy', 'name email');
    
    // Trigger notification
    const project = await Project.findById(translation.projectId);
    const ownerUser = await User.findById(project?.owner);
    if (ownerUser?.email) {
      sendApprovalEmail(ownerUser.email, project!, { ...translation.toObject(), value: '[REQUESTED DELETION]' } as any).catch(e => console.error('Delete request email failed:', e));
    }
    
    return res.status(200).json(updated);
  }

  // Soft delete for others
  await Translation.findByIdAndUpdate(req.params.id, { isArchived: true });
  res.status(204).send();
};

export const restoreTranslation = async (req: AuthRequest, res: Response) => {
  await Translation.findByIdAndUpdate(req.params.id, { isArchived: false });
  res.status(200).json({ message: 'Restored' });
};

export const updateTranslation = async (req: AuthRequest, res: Response) => {
  try {
    const { value } = req.body;
    const translation = await Translation.findById(req.params.id);
    if (!translation) return res.status(404).json({ message: 'Translation not found' });

    const membership = await ProjectMember.findOne({ projectId: translation.projectId, userId: req.user!._id });
    if (!membership || membership.role === 'VIEWER') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // If Editor edits PROD, it goes back to PENDING_APPROVAL
    let status = translation.status;
    let requestedBy = translation.requestedBy;
    let requestedAction = translation.requestedAction;

    if (translation.environment === 'PROD' && (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      status = 'PENDING_APPROVAL';
      requestedBy = req.user!._id;
      requestedAction = 'UPDATE';
      const previousValue = translation.value; // Store current for possible revert
      
      // Trigger email
      try {
        const projectDoc = await Project.findById(translation.projectId);
        const ownerUser = await User.findById(projectDoc?.owner);
        if (ownerUser?.email) {
          sendApprovalEmail(ownerUser.email, projectDoc, { ...translation.toObject(), value }).catch(e => console.error('Email update failed:', e));
        }
      } catch (e) {
        console.error('Failed to trigger update approval email:', e);
      }
      
      const updated = await Translation.findByIdAndUpdate(
        req.params.id,
        { value, status, updatedBy: req.user!._id, requestedBy, requestedAction, previousValue },
        { new: true }
      ).populate('requestedBy', 'name email');
      return res.json(updated);
    }

    const updated = await Translation.findByIdAndUpdate(
      req.params.id,
      { value, status, updatedBy: req.user!._id },
      { new: true }
    );

    res.json(updated);
  } catch (error: any) {
    console.error('Update Translation Error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const updateKey = async (req: AuthRequest, res: Response) => {
  const { projectId, oldKey } = req.params;
  const { newKey } = req.body;
  const { environment = 'DEV' } = req.query;
  
  if (!newKey) return res.status(400).json({ message: 'New key name is required' });

  const membership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  if (!membership || membership.role === 'VIEWER') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Block Editors from renaming in PROD for now
  if (environment === 'PROD' && (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    return res.status(403).json({ message: 'Only Admins can rename keys in Production.' });
  }

  const result = await Translation.updateMany(
    { projectId, key: oldKey, environment },
    { key: newKey, updatedBy: req.user!._id }
  );

  res.json({ message: `Updated ${result.modifiedCount} translations`, modifiedCount: result.modifiedCount });
};

export const deleteKey = async (req: AuthRequest, res: Response) => {
  const { projectId, key } = req.params;
  const { environment = 'DEV' } = req.query;

  const membership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  if (!membership || membership.role === 'VIEWER') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Editors cannot delete PROD keys directly, but can request it
  if (environment === 'PROD' && (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    const result = await Translation.updateMany(
      { projectId, key, environment },
      { 
        status: 'PENDING_APPROVAL', 
        requestedBy: req.user!._id, 
        requestedAction: 'DELETE' 
      }
    );

    if (result.modifiedCount > 0) {
      // Trigger notification
      const project = await Project.findById(projectId);
      const ownerUser = await User.findById(project?.owner);
      if (ownerUser?.email) {
        sendApprovalEmail(ownerUser.email, project!, { key, language: 'All', value: '[REQUESTED KEY DELETION]' } as any).catch(e => console.error('Key delete request email failed:', e));
      }
    }

    return res.status(200).json({ 
      message: 'Key deletion request sent for approval', 
      requestedCount: result.modifiedCount 
    });
  }
  
  const result = await Translation.deleteMany({ projectId, key, environment });

  res.json({ message: `Deleted ${result.deletedCount} translations`, deletedCount: result.deletedCount });
};

export const createSnapshotHandler = async (req: AuthRequest, res: Response) => {
  const { projectId, version } = req.body;
  try {
    const snapshot = await createSnapshot(projectId, version, req.user!._id as string);
    res.status(201).json(snapshot);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const rollbackHandler = async (req: AuthRequest, res: Response) => {
  const { projectId, version } = req.body;
  try {
    const result = await rollbackToVersion(projectId, version, req.user!._id as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const aiTranslate = async (req: AuthRequest, res: Response) => {
  const { text, targetLanguages, sourceLanguage } = req.body;
  
  if (!text || !targetLanguages || !Array.isArray(targetLanguages)) {
    return res.status(400).json({ message: 'Invalid request: text and targetLanguages array are required' });
  }

  try {
    const translations = await translateText(text, targetLanguages, sourceLanguage);
    res.json(translations);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveTranslation = async (req: AuthRequest, res: Response) => {
  const translation = await Translation.findById(req.params.id);
  if (!translation) return res.status(404).json({ message: 'Not found' });

  const membership = await ProjectMember.findOne({ projectId: translation.projectId, userId: req.user!._id });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    return res.status(403).json({ message: 'Only Admins can approve' });
  }

  if (translation.requestedAction === 'DELETE') {
    translation.isArchived = true;
  }
  
  translation.status = 'APPROVED';
  translation.requestedBy = undefined;
  translation.requestedAction = undefined;
  translation.updatedBy = req.user!._id;
  await translation.save();
  res.json(translation);
};

export const rejectTranslation = async (req: AuthRequest, res: Response) => {
  const { deleteRecord = false } = req.body;
  const translation = await Translation.findById(req.params.id);
  if (!translation) return res.status(404).json({ message: 'Not found' });

  const membership = await ProjectMember.findOne({ projectId: translation.projectId, userId: req.user!._id });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    return res.status(403).json({ message: 'Only Admins can reject' });
  }

  if (deleteRecord) {
    translation.isArchived = true;
  } else {
    // Revert logic
    if (translation.requestedAction === 'UPDATE' && translation.previousValue) {
      translation.value = translation.previousValue;
      translation.status = 'APPROVED';
    } else if (translation.requestedAction === 'DELETE') {
      translation.status = 'APPROVED'; // Cancel deletion
    } else {
      translation.status = 'REJECTED'; // New translation rejected
    }
  }

  translation.requestedBy = undefined;
  translation.requestedAction = undefined;
  translation.previousValue = undefined;
  translation.updatedBy = req.user!._id;
  await translation.save();
  
  const populated = await Translation.findById(translation._id).populate('requestedBy', 'name email');
  res.json(populated || translation);
};

export const bulkUpload = async (req: AuthRequest, res: Response) => {
  const { projectId, data, environment = 'DEV' } = req.body;
  
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ message: 'Invalid JSON data' });
  }

  try {
    // RBAC Check
    let membership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
    const project = await Project.findById(projectId);
    
    if (!membership && project?.owner?.toString() === req.user!._id.toString()) {
      membership = { role: 'OWNER' } as any;
    }

    if (!membership || membership.role === 'VIEWER') {
      return res.status(403).json({ message: 'Forbidden: You do not have permissions to upload to this project' });
    }

    // PROD Governance
    let status = 'APPROVED';
    if (environment === 'PROD' && (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      status = 'PENDING_APPROVAL';
    }

    const results = [];
    for (const [lang, keys] of Object.entries(data)) {
      if (typeof keys !== 'object') continue;
      
      for (const [key, value] of Object.entries(keys as object)) {
        const translation = await Translation.findOneAndUpdate(
          { projectId, language: lang, key, environment, namespace: 'common' },
          { value, status, updatedBy: req.user!._id, isArchived: false },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (!translation.createdBy) {
          translation.createdBy = req.user!._id;
          await translation.save();
        }
        results.push(translation);
      }
    }

    // Trigger one notification for the whole batch if pending
    if (status === 'PENDING_APPROVAL' && project) {
      try {
        const ownerUser = await User.findById(project.owner);
        if (ownerUser?.email) {
          // Just notify the owner that a bulk upload happened and needs review
          // We can use a simplified version of sendApprovalEmail or a dedicated one
          sendApprovalEmail(ownerUser.email, project, { key: 'Multiple Keys (Bulk Upload)', language: 'Multiple', value: 'Bulk update batch' } as any)
            .catch(e => console.error('Bulk email failed:', e));
        }
      } catch (e) {
        console.error('Failed to trigger bulk approval email:', e);
      }
    }

    res.status(201).json({ message: `Successfully imported ${results.length} keys`, count: results.length, status });
  } catch (error: any) {
    console.error('Bulk Upload Error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

