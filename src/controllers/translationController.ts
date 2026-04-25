import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Translation from '../models/Translation';
import Project from '../models/Project';
import ProjectMember from '../models/ProjectMember';
import { createSnapshot, rollbackToVersion } from '../services/versioning.service';
import { translateText } from '../services/ai.service';
import { sendApprovalEmail } from '../services/email.service';

export const createTranslation = async (req: AuthRequest, res: Response) => {
  const { projectId, language, namespace, key, value, environment = 'DEV', status: providedStatus } = req.body;
  
  // RBAC Check
  let membership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  const project = await Project.findById(projectId);
  
  if (!membership && project?.owner?.toString() === req.user!._id.toString()) {
    // Owner is always an ADMIN if not explicitly in membership
    membership = { role: 'OWNER' } as any;
  }

  if (!membership) return res.status(403).json({ message: 'Forbidden' });

  let status = providedStatus || (environment === 'PROD' && membership.role !== 'OWNER' && membership.role !== 'ADMIN' ? 'PENDING_APPROVAL' : 'APPROVED');

  const translation = await Translation.findOneAndUpdate(
    { projectId, language, namespace, key, environment },
    { value, status, updatedBy: req.user!._id, isArchived: false },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (!translation.createdBy) {
    translation.createdBy = req.user!._id;
    await translation.save();
  }

  // Handle Approval Email
  if (status === 'PENDING_APPROVAL') {
    const project = await Project.findById(projectId);
    const owner = await ProjectMember.findOne({ projectId, role: 'OWNER' }).populate('userId');
    if (owner && (owner.userId as any).email) {
      await sendApprovalEmail((owner.userId as any).email, project, translation);
    }
  }

  res.status(201).json(translation);
};

export const getTranslationsForProject = async (req: AuthRequest, res: Response) => {
  const { environment = 'DEV' } = req.query;
  const translations = await Translation.find({ 
    projectId: req.params.projectId,
    environment,
    isArchived: false
  });
  res.json(translations);
};

export const deleteTranslation = async (req: AuthRequest, res: Response) => {
  // Soft delete for Undo functionality
  await Translation.findByIdAndUpdate(req.params.id, { isArchived: true });
  res.status(204).send();
};

export const restoreTranslation = async (req: AuthRequest, res: Response) => {
  await Translation.findByIdAndUpdate(req.params.id, { isArchived: false });
  res.status(200).json({ message: 'Restored' });
};

export const updateTranslation = async (req: AuthRequest, res: Response) => {
  const { value } = req.body;
  const translation = await Translation.findByIdAndUpdate(
    req.params.id,
    { value, updatedBy: req.user!._id },
    { new: true }
  );
  if (!translation) return res.status(404).json({ message: 'Translation not found' });
  res.json(translation);
};

export const updateKey = async (req: AuthRequest, res: Response) => {
  const { projectId, oldKey } = req.params;
  const { newKey } = req.body;
  
  if (!newKey) return res.status(400).json({ message: 'New key name is required' });

  const result = await Translation.updateMany(
    { projectId, key: oldKey },
    { key: newKey, updatedBy: req.user!._id }
  );

  res.json({ message: `Updated ${result.modifiedCount} translations`, modifiedCount: result.modifiedCount });
};

export const deleteKey = async (req: AuthRequest, res: Response) => {
  const { projectId, key } = req.params;
  
  const result = await Translation.deleteMany({ projectId, key });

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
  const translation = await Translation.findByIdAndUpdate(
    req.params.id,
    { status: 'APPROVED', updatedBy: req.user!._id },
    { new: true }
  );
  if (!translation) return res.status(404).json({ message: 'Translation not found' });
  res.json(translation);
};

export const bulkUpload = async (req: AuthRequest, res: Response) => {
  const { projectId, data, environment = 'DEV' } = req.body;
  
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ message: 'Invalid JSON data' });
  }

  const results = [];
  try {
    for (const [lang, keys] of Object.entries(data)) {
      if (typeof keys !== 'object') continue;
      
      for (const [key, value] of Object.entries(keys as object)) {
        const translation = await Translation.findOneAndUpdate(
          { projectId, language: lang, key, environment, namespace: 'common' },
          { value, status: 'APPROVED', updatedBy: req.user!._id, isArchived: false },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (!translation.createdBy) {
          translation.createdBy = req.user!._id;
          await translation.save();
        }
        results.push(translation);
      }
    }
    res.status(201).json({ message: `Successfully imported ${results.length} keys`, count: results.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

