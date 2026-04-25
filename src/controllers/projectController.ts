import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Project from '../models/Project';
import User from '../models/User';
import Invitation from '../models/Invitation';
import ProjectMember from '../models/ProjectMember';
import ApiKey, { ApiKeyPermission, ApiKeyEnvironment } from '../models/ApiKey';
import { generateApiKey } from '../services/apiKey.service';
import crypto from 'crypto';

export const createProject = async (req: AuthRequest, res: Response) => {
  const { name, description, defaultLanguage } = req.body;
  const project = await Project.create({
    name,
    description,
    defaultLanguage,
    owner: req.user!._id
  });

  // Add the creator as an OWNER in the members table
  await ProjectMember.create({
    projectId: project._id,
    userId: req.user!._id,
    role: 'OWNER'
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
  // Fetch projects where the user is a member
  const memberships = await ProjectMember.find({ userId: req.user!._id }).populate('projectId');
  const projects = memberships.map(m => m.projectId).filter(p => p !== null);
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

export const inviteMember = async (req: AuthRequest, res: Response) => {
  const { email, role } = req.body;
  const projectId = req.params.id;

  // Check if already a member
  const existingMember = await ProjectMember.findOne({ projectId, userId: (await User.findOne({ email }))?._id });
  if (existingMember) return res.status(400).json({ message: 'User is already a member' });

  // Create invitation
  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await Invitation.create({
    projectId,
    email,
    role,
    invitedBy: req.user!._id,
    token
  });

  // In a real app, send email here. For now, just return success.
  res.status(201).json({ message: 'Invitation sent', invitation });
};

export const getProjectMembers = async (req: AuthRequest, res: Response) => {
  const members = await ProjectMember.find({ projectId: req.params.id }).populate('userId', 'email name');
  res.json(members);
};
