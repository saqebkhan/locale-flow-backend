import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Project from '../models/Project';
import User from '../models/User';
import Invitation from '../models/Invitation';
import ProjectMember from '../models/ProjectMember';
import ApiKey, { ApiKeyPermission, ApiKeyEnvironment } from '../models/ApiKey';
import { generateApiKey } from '../services/apiKey.service';
import { sendInvitationEmail } from '../services/email.service';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import express from 'express';

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

  // Fetch project name for the email
  const project = await Project.findById(projectId);

  // Send the invitation email
  try {
    await sendInvitationEmail(email, project, role, token);
    res.status(201).json({ message: 'Invitation sent', invitation });
  } catch (error: any) {
    console.error('Failed to send invitation email:', error);
    res.status(500).json({ 
      message: 'Invitation recorded but email failed: ' + (error.message || 'Unknown error'),
      invitation 
    });
  }
};

export const getProjectMembers = async (req: AuthRequest, res: Response) => {
  const members = await ProjectMember.find({ projectId: req.params.id }).populate('userId', 'email name');
  res.json(members);
};

export const acceptInvitation = async (req: AuthRequest, res: Response) => {
  const { token } = req.params;
  const invitation = await Invitation.findOne({ token, status: 'PENDING' });

  if (!invitation) {
    return res.status(404).json({ message: 'Invitation not found or already processed' });
  }

  // Ensure the logged-in user matches the invited email (optional but recommended)
  // if (invitation.email !== req.user!.email) { ... }

  // Create project membership
  await ProjectMember.create({
    projectId: invitation.projectId,
    userId: req.user!._id,
    role: invitation.role
  });

  // Update invitation status
  invitation.status = 'ACCEPTED';
  await invitation.save();

  res.json({ message: 'Invitation accepted', projectId: invitation.projectId });
};

export const getInvitation = async (req: express.Request, res: Response) => {
  const { token } = req.params;
  const invitation = await Invitation.findOne({ token, status: 'PENDING' }).populate('projectId', 'name');

  if (!invitation) {
    return res.status(404).json({ message: 'Invitation not found or already processed' });
  }

  res.json(invitation);
};

export const joinByInvitation = async (req: express.Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.body;
  
  const invitation = await Invitation.findOne({ token, status: 'PENDING' });
  if (!invitation) {
    return res.status(404).json({ message: 'Invitation not found' });
  }

  // Create user
  let user = await User.findOne({ email: invitation.email });
  if (!user) {
    user = await User.create({
      email: invitation.email,
      password, // Note: User model should hash this in its pre-save hook
      name: invitation.email.split('@')[0]
    });
  }

  // Add to project
  await ProjectMember.create({
    projectId: invitation.projectId,
    userId: user._id,
    role: invitation.role
  });

  invitation.status = 'ACCEPTED';
  await invitation.save();

  // Generate JWT for immediate login
  const jwtToken = jwt.sign({ _id: user._id }, process.env.JWT_SECRET || 'secret');
  
  res.json({ 
    message: 'Welcome to the team!', 
    projectId: invitation.projectId,
    user: { _id: user._id, email: user.email, name: user.name, token: jwtToken }
  });
};
