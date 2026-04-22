import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Project from '../models/Project';
import ApiKey, { ApiKeyPermission, ApiKeyEnvironment } from '../models/ApiKey';
import { generateApiKey } from '../services/apiKey.service';

export const createProject = async (req: AuthRequest, res: Response) => {
  const { name, description, defaultLanguage } = req.body;
  const project = await Project.create({
    name,
    description,
    defaultLanguage,
    owner: req.user!._id
  });

  // Automatically generate an initial production read-only key
  const { rawKey } = await generateApiKey(
    project._id as string,
    'Default Production Key',
    ApiKeyPermission.READ_ONLY,
    ApiKeyEnvironment.PRODUCTION
  );

  res.status(201).json({ project, initialApiKey: rawKey });
};

export const getProjects = async (req: AuthRequest, res: Response) => {
  const projects = await Project.find({ owner: req.user!._id });
  res.json(projects);
};

export const getProjectKeys = async (req: AuthRequest, res: Response) => {
  const keys = await ApiKey.find({ projectId: req.params.id }).select('-keyHash');
  res.json(keys);
};

export const createNewKey = async (req: AuthRequest, res: Response) => {
  const { name, permission, environment } = req.body;
  const { rawKey, apiKey } = await generateApiKey(
    req.params.id,
    name,
    permission,
    environment
  );
  res.status(201).json({ rawKey, apiKey });
};

export const getProjectDetails = async (req: AuthRequest, res: Response) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  res.json(project);
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!project) return res.status(404).json({ message: 'Project not found' });
  res.json(project);
};
