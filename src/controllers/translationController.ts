import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Translation from '../models/Translation.js';
import Project from '../models/Project.js';
import ProjectMember from '../models/ProjectMember.js';
import User from '../models/User.js';
import { createSnapshot, rollbackToVersion } from '../services/versioning.service.js';
import { translateText } from '../services/ai.service.js';
import { sendApprovalEmail } from '../services/email.service.js';
import { cacheService } from '../services/cache.service.js';
import { ROLES, TRANSLATION_STATUS, REQUEST_ACTIONS, ENVIRONMENTS } from '../constants/index.js';
import { resolveEffectiveMembership, isPrivilegedRole } from '../utils/rbac.js';
import { logger } from '../utils/logger.js';

export const createTranslation = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, language, namespace, key, value, environment = ENVIRONMENTS.DEVELOPMENT, status: providedStatus } = req.body;
    
    if (!projectId || !key || !language) {
      return res.status(400).json({ message: 'Project ID, Key, and Language are required' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized: No user found' });
    }

    // RBAC Check
    const { membership, project } = await resolveEffectiveMembership(projectId, req.user!._id.toString());

    if (!membership) return res.status(403).json({ message: 'Forbidden: You do not have access to this project' });

    // 1. VIEWER Restriction
    if (membership.role === ROLES.VIEWER) {
      return res.status(403).json({ message: 'Viewers cannot modify translations' });
    }

    // 2. PROD Governance for EDITOR
    let status = providedStatus || TRANSLATION_STATUS.APPROVED;
    let requestedBy = undefined;
    let requestedAction = undefined;

    const isRestricted = project?.restrictedEnvironments?.includes(environment);
    if (isRestricted && !isPrivilegedRole(membership.role)) {
      status = TRANSLATION_STATUS.PENDING_APPROVAL;
      requestedBy = req.user!._id;
      requestedAction = REQUEST_ACTIONS.CREATE;
    }

    // Duplication Checks (Check for ANY record, including archived, to prevent E11000)
    const existing = await Translation.findOne({ projectId, language, namespace, key, environment });
    
    if (existing) {
      if (!existing.isArchived) {
        return res.status(409).json({ message: `The key "${key}" already exists for ${language.toUpperCase()} in ${namespace}.` });
      } else {
        // Reactivate archived key
        existing.value = value;
        existing.status = status;
        existing.isArchived = false;
        existing.requestedBy = requestedBy;
        existing.requestedAction = requestedAction;
        existing.updatedBy = req.user!._id;
        await existing.save();
        
        await cacheService.invalidatePattern(`sdk:${projectId}:${environment}`);
        return res.json(existing);
      }
    }

    const existingValue = await Translation.findOne({ projectId, language, namespace, value, environment, isArchived: false });
    if (existingValue) {
      return res.status(409).json({ message: `Value "${value}" is already used by key "${existingValue.key}" for this language.` });
    }

    const translation = new Translation({
      projectId,
      language,
      namespace,
      key,
      value,
      environment,
      status,
      updatedBy: req.user!._id,
      createdBy: req.user!._id,
      isArchived: false,
      requestedBy,
      requestedAction
    });

    await translation.save();
    await cacheService.invalidatePattern(`sdk:${projectId}:${environment}`);

    // Handle Approval Email (Non-blocking)
    if (status === TRANSLATION_STATUS.PENDING_APPROVAL && project) {
      try {
        const ownerUser = await User.findById(project.owner);
        if (ownerUser?.email) {
          sendApprovalEmail(ownerUser.email, project, translation).catch(e => logger.error('Email failed:', e));
        }
      } catch (e) {
        logger.error('Failed to trigger approval email:', e);
      }
    }

    await translation.populate('requestedBy', 'name email');

    return res.status(201).json(translation);
  } catch (error: any) {
    logger.error('Create Translation Error:', error);
    return res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const getTranslationsForProject = async (req: AuthRequest, res: Response) => {
  const { environment = ENVIRONMENTS.DEVELOPMENT } = req.query;
  const translations = await Translation.find({ 
    projectId: req.params.projectId,
    environment,
    isArchived: false
  })
  .populate('requestedBy', 'name email')
  .lean();
  res.json(translations);
};

export const deleteTranslation = async (req: AuthRequest, res: Response) => {
  const translation = await Translation.findById(req.params.id);
  if (!translation) return res.status(404).json({ message: 'Not found' });

  const membership = await ProjectMember.findOne({ projectId: translation.projectId, userId: req.user!._id });
  if (!membership || membership.role === ROLES.VIEWER) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const project = await Project.findById(translation.projectId);
  const isRestricted = project?.restrictedEnvironments?.includes(translation.environment);

  // Editors cannot delete restricted translations directly, but can request it
  if (isRestricted && !isPrivilegedRole(membership.role)) {
    const updated = await Translation.findByIdAndUpdate(req.params.id, { 
      status: TRANSLATION_STATUS.PENDING_APPROVAL, 
      requestedBy: req.user!._id, 
      requestedAction: REQUEST_ACTIONS.DELETE 
    }, { new: true }).populate('requestedBy', 'name email');
    
    // Trigger notification
    const ownerUser = await User.findById(project?.owner);
    if (ownerUser?.email) {
      sendApprovalEmail(ownerUser.email, project!, { ...translation.toObject(), value: '[REQUESTED DELETION]' } as any).catch(e => logger.error('Delete request email failed:', e));
    }
    
    return res.status(200).json(updated);
  }

  // Soft delete for others
  await Translation.findByIdAndUpdate(req.params.id, { isArchived: true });
  await cacheService.invalidatePattern(`sdk:${translation.projectId}:${translation.environment}`);
  res.status(204).send();
};

export const restoreTranslation = async (req: AuthRequest, res: Response) => {
  const t = await Translation.findByIdAndUpdate(req.params.id, { isArchived: false });
  if (t) await cacheService.invalidatePattern(`sdk:${t.projectId}:${t.environment}`);
  res.status(200).json({ message: 'Restored' });
};

export const updateTranslation = async (req: AuthRequest, res: Response) => {
  try {
    const { value, status: providedStatus } = req.body;
    const translation = await Translation.findById(req.params.id);
    if (!translation) return res.status(404).json({ message: 'Translation not found' });

    const membership = await ProjectMember.findOne({ projectId: translation.projectId, userId: req.user!._id });
    if (!membership || membership.role === ROLES.VIEWER) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const projectDoc = await Project.findById(translation.projectId);
    const isRestricted = projectDoc?.restrictedEnvironments?.includes(translation.environment);

    // Value Duplication Check
    const existingValue = await Translation.findOne({ 
      projectId: translation.projectId, 
      language: translation.language, 
      namespace: translation.namespace, 
      value, 
      environment: translation.environment,
      isArchived: false,
      _id: { $ne: req.params.id } 
    });

    if (existingValue) {
      return res.status(409).json({ message: `The value "${value}" is already used by key "${existingValue.key}"` });
    }

    // If Editor edits restricted env, it goes back to PENDING_APPROVAL
    let status = providedStatus || translation.status;
    let requestedBy = translation.requestedBy;
    let requestedAction = translation.requestedAction;

    if (isRestricted && !isPrivilegedRole(membership.role)) {
      status = TRANSLATION_STATUS.PENDING_APPROVAL;
      requestedBy = req.user!._id;
      requestedAction = REQUEST_ACTIONS.UPDATE;
      const previousValue = translation.value; // Store current for possible revert
      
      // Trigger email
      try {
        const ownerUser = await User.findById(projectDoc?.owner);
        if (ownerUser?.email) {
          sendApprovalEmail(ownerUser.email, projectDoc, { ...translation.toObject(), value }).catch(e => logger.error('Email update failed:', e));
        }
      } catch (e) {
        logger.error('Failed to trigger update approval email:', e);
      }
      
      const updated = await Translation.findByIdAndUpdate(
        req.params.id,
        { value, status, updatedBy: req.user!._id, requestedBy, requestedAction, previousValue },
        { new: true }
      ).populate('requestedBy', 'name email');
      if (updated) await cacheService.invalidatePattern(`sdk:${updated.projectId}:${updated.environment}`);
      return res.json(updated);
    }

    const updated = await Translation.findByIdAndUpdate(
      req.params.id,
      { value, status, updatedBy: req.user!._id },
      { new: true }
    );
    if (updated) await cacheService.invalidatePattern(`sdk:${updated.projectId}:${updated.environment}`);

    res.json(updated);
  } catch (error: any) {
    logger.error('Update Translation Error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const updateKey = async (req: AuthRequest, res: Response) => {
  const { projectId, oldKey } = req.params;
  const { newKey } = req.body;
  const { environment = ENVIRONMENTS.DEVELOPMENT } = req.query;
  
  if (!newKey) return res.status(400).json({ message: 'New key name is required' });

  const membership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  if (!membership || membership.role === ROLES.VIEWER) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const project = await Project.findById(projectId);
  const isRestricted = project?.restrictedEnvironments?.includes(environment);

  // Block Editors from renaming in restricted envs for now
  if (isRestricted && !isPrivilegedRole(membership.role)) {
    return res.status(403).json({ message: 'Only Admins can rename keys in restricted environments.' });
  }

  // Key Duplication Check
  const existingKey = await Translation.findOne({ projectId, key: newKey, environment, isArchived: false });
  if (existingKey) {
    return res.status(409).json({ message: `Key "${newKey}" already exists in this environment.` });
  }

  const result = await Translation.updateMany(
    { projectId, key: oldKey, environment },
    { key: newKey, updatedBy: req.user!._id }
  );

  await cacheService.invalidatePattern(`sdk:${projectId}:${environment}`);

  res.json({ message: `Updated ${result.modifiedCount} translations`, modifiedCount: result.modifiedCount });
};

export const deleteKey = async (req: AuthRequest, res: Response) => {
  const { projectId, key } = req.params;
  const { environment = ENVIRONMENTS.DEVELOPMENT } = req.query;

  const membership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  if (!membership || membership.role === ROLES.VIEWER) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const project = await Project.findById(projectId);
  const isRestricted = project?.restrictedEnvironments?.includes(environment);

  // Editors cannot delete keys in restricted envs directly, but can request it
  if (isRestricted && !isPrivilegedRole(membership.role)) {
    const result = await Translation.updateMany(
      { projectId, key, environment },
      { 
        status: TRANSLATION_STATUS.PENDING_APPROVAL, 
        requestedBy: req.user!._id, 
        requestedAction: REQUEST_ACTIONS.DELETE 
      }
    );

    if (result.modifiedCount > 0) {
      // Trigger notification
      const ownerUser = await User.findById(project?.owner);
      if (ownerUser?.email) {
        sendApprovalEmail(ownerUser.email, project!, { key, language: 'All', value: '[REQUESTED KEY DELETION]' } as any).catch(e => logger.error('Key delete request email failed:', e));
      }
    }

    return res.status(200).json({ 
      message: 'Key deletion request sent for approval', 
      requestedCount: result.modifiedCount 
    });
  }
  
  const result = await Translation.deleteMany({ projectId, key, environment });
  await cacheService.invalidatePattern(`sdk:${projectId}:${environment}`);

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
  const project = await Project.findById(translation.projectId);
  const isRestricted = project?.restrictedEnvironments?.includes(translation.environment);

  // Owners/Admins can always approve. Editors can approve if environment is NOT restricted.
  const canApprove = (membership?.role === ROLES.OWNER || membership?.role === ROLES.ADMIN) || (!isRestricted && membership?.role === ROLES.EDITOR);

  if (!canApprove) {
    return res.status(403).json({ message: 'Only Admins can approve in restricted environments.' });
  }

  if (translation.requestedAction === REQUEST_ACTIONS.DELETE) {
    translation.isArchived = true;
  }
  
  translation.status = TRANSLATION_STATUS.APPROVED;
  translation.requestedBy = undefined;
  translation.requestedAction = undefined;
  translation.updatedBy = req.user!._id;
  await translation.save();
  await cacheService.invalidatePattern(`sdk:${translation.projectId}:${translation.environment}`);
  res.json(translation);
};

export const rejectTranslation = async (req: AuthRequest, res: Response) => {
  const { deleteRecord = false } = req.body;
  const translation = await Translation.findById(req.params.id);
  if (!translation) return res.status(404).json({ message: 'Not found' });

  const membership = await ProjectMember.findOne({ projectId: translation.projectId, userId: req.user!._id });
  if (!membership || !isPrivilegedRole(membership.role)) {
    return res.status(403).json({ message: 'Only Admins can reject' });
  }

  if (deleteRecord) {
    translation.isArchived = true;
  } else {
    // Revert logic
    if (translation.requestedAction === REQUEST_ACTIONS.UPDATE && translation.previousValue) {
      translation.value = translation.previousValue;
      translation.status = TRANSLATION_STATUS.APPROVED;
    } else if (translation.requestedAction === REQUEST_ACTIONS.DELETE) {
      translation.status = TRANSLATION_STATUS.APPROVED; // Cancel deletion
    } else {
      translation.status = TRANSLATION_STATUS.REJECTED; // New translation rejected
    }
  }

  translation.requestedBy = undefined;
  translation.requestedAction = undefined;
  translation.previousValue = undefined;
  translation.updatedBy = req.user!._id;
  await translation.save();
  await cacheService.invalidatePattern(`sdk:${translation.projectId}:${translation.environment}`);
  
  const populated = await Translation.findById(translation._id).populate('requestedBy', 'name email');
  res.json(populated || translation);
};

export const bulkUpload = async (req: AuthRequest, res: Response) => {
  const { projectId, data, environment = ENVIRONMENTS.DEVELOPMENT } = req.body;
  
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ message: 'Invalid JSON data' });
  }

  try {
    // RBAC Check
    const { membership, project } = await resolveEffectiveMembership(projectId, req.user!._id.toString());

    if (!membership || membership.role === ROLES.VIEWER) {
      return res.status(403).json({ message: 'Forbidden: You do not have permissions to upload to this project' });
    }

    // Restricted Governance
    let status = TRANSLATION_STATUS.APPROVED;
    const isRestricted = project?.restrictedEnvironments?.includes(environment);
    if (isRestricted && !isPrivilegedRole(membership.role)) {
      status = TRANSLATION_STATUS.PENDING_APPROVAL;
    }

    const results = [];
    let skippedCount = 0;

    for (const [lang, keys] of Object.entries(data)) {
      if (typeof keys !== 'object') continue;
      
      for (const [key, value] of Object.entries(keys as object)) {
        // Check for duplicate key/lang combo
        const existing = await Translation.findOne({ projectId, language: lang, key, environment, isArchived: false });
        
        if (existing) {
          skippedCount++;
          continue;
        }

        // Check for duplicate value
        const existingValue = await Translation.findOne({ projectId, language: lang, value, environment, isArchived: false });
        if (existingValue) {
          skippedCount++;
          continue;
        }

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
    if (status === TRANSLATION_STATUS.PENDING_APPROVAL && project) {
      try {
        const ownerUser = await User.findById(project.owner);
        if (ownerUser?.email) {
          sendApprovalEmail(ownerUser.email, project, { key: 'Multiple Keys (Bulk Upload)', language: 'Multiple', value: 'Bulk update batch' } as any)
            .catch(e => logger.error('Bulk email failed:', e));
        }
      } catch (e) {
        logger.error('Failed to trigger bulk approval email:', e);
      }
    }

    if (results.length > 0) {
      await cacheService.invalidatePattern(`sdk:${projectId}:${environment}`);
    }

    res.status(201).json({ 
      message: `Successfully imported ${results.length} keys. Skipped ${skippedCount} duplicates.`, 
      count: results.length, 
      skippedCount,
      status 
    });
  } catch (error: any) {
    logger.error('Bulk Upload Error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const getProjectPendingStats = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const stats = await Translation.aggregate([
      { 
        $match: { 
          projectId: new mongoose.Types.ObjectId(projectId), 
          status: TRANSLATION_STATUS.PENDING_APPROVAL,
          isArchived: false 
        } 
      },
      { $group: { _id: '$environment', count: { $sum: 1 } } }
    ]);

    const total = stats.reduce((acc, curr) => acc + curr.count, 0);
    const byEnvironment = stats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {} as Record<string, number>);

    res.json({ total, byEnvironment });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
