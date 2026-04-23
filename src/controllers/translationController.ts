import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Translation from '../models/Translation';
import { createSnapshot, rollbackToVersion } from '../services/versioning.service';

export const createTranslation = async (req: AuthRequest, res: Response) => {
  const { projectId, language, namespace, key, value } = req.body;
  const translation = await Translation.findOneAndUpdate(
    { projectId, language, namespace, key },
    { value, updatedBy: req.user!._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (!translation.createdBy) {
    translation.createdBy = req.user!._id;
    await translation.save();
  }
  res.status(201).json(translation);
};

export const getTranslationsForProject = async (req: AuthRequest, res: Response) => {
  const translations = await Translation.find({ projectId: req.params.projectId });
  res.json(translations);
};

export const deleteTranslation = async (req: AuthRequest, res: Response) => {
  await Translation.findByIdAndDelete(req.params.id);
  res.status(204).send();
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

