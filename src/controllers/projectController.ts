import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Project from '../models/Project';
import User from '../models/User';
import Invitation from '../models/Invitation';
import ProjectMember from '../models/ProjectMember';
import ApiKey, { ApiKeyPermission } from '../models/ApiKey';
import { generateApiKey, decrypt, rotateApiKey } from '../services/apiKey.service';
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

  // Automatically generate an initial development read-only key
  const { rawKey } = await generateApiKey(
    project._id as string,
    'Initial Development Key',
    ApiKeyPermission.READ_ONLY,
    'DEVELOPMENT'
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
  const projectId = req.params.id;
  const requesterMembership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  const isPrivileged = requesterMembership && (requesterMembership.role === 'OWNER' || requesterMembership.role === 'ADMIN');

  // We want to return a status for EACH environment in the project
  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const environments = project.environments || ['DEVELOPMENT'];
  const keys = await ApiKey.find({ projectId }).select('-keyHash');
  
  const response = environments.map(env => {
    const key = keys.find(k => k.environment === env);
    if (!key) return { environment: env, status: 'EMPTY' };

    const isRestricted = project.restrictedEnvironments?.includes(env);
    // Non-admins can only see restricted keys if privileged
    if (isRestricted && !isPrivileged) {
      return { 
        _id: key._id,
        environment: env, 
        name: key.name, 
        status: 'RESTRICTED',
        key: '•••••••••••••••• (Admin Only)'
      };
    }

    const keyObj = key.toObject();
    if (!keyObj.encryptedKey) {
      keyObj.key = 'Legacy Key (Regenerate to View)';
    } else {
      try {
        keyObj.key = decrypt(keyObj.encryptedKey);
      } catch (e) {
        keyObj.key = 'Decryption Error';
      }
    }
    delete keyObj.encryptedKey;
    return { ...keyObj, status: 'ACTIVE' };
  });

  res.json(response);
};

export const createNewKey = async (req: AuthRequest, res: Response) => {
  const { environment, permission = ApiKeyPermission.READ_ONLY } = req.body;
  const projectId = req.params.id;
  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  if (!environment || !project.environments.includes(environment)) {
    return res.status(400).json({ message: 'Valid environment from project list is required' });
  }

  // Check if a key already exists for this environment
  const existingKey = await ApiKey.findOne({ projectId, environment });
  if (existingKey) {
    return res.status(400).json({ 
      message: `A key for the ${environment} environment already exists. Use the Rotate function to change it.` 
    });
  }

  try {
    const { rawKey, apiKey } = await generateApiKey(
      projectId,
      `${environment.charAt(0) + environment.slice(1).toLowerCase()} SDK Key`,
      permission,
      environment
    );
    res.status(201).json({ rawKey, apiKey });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to provision key: ' + err.message });
  }
};

export const addEnvironment = async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const projectId = req.params.id;

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Environment name is required' });
  }

  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  // Prevent duplicates (case insensitive)
  if (project.environments.some(e => e.toUpperCase() === name.toUpperCase())) {
    return res.status(400).json({ message: 'Environment already exists' });
  }

  project.environments.push(name.trim());
  await project.save();

  res.status(201).json(project.environments);
};

export const removeEnvironment = async (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  const projectId = req.params.id;

  if (name === 'DEVELOPMENT') {
    return res.status(400).json({ message: 'Cannot delete the default DEVELOPMENT environment' });
  }

  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  if (!project.environments.includes(name)) {
    return res.status(404).json({ message: 'Environment not found' });
  }

  // Remove from array
  project.environments = project.environments.filter(e => e !== name);
  await project.save();

  // Cleanup: Delete API keys for this environment
  await ApiKey.deleteMany({ projectId, environment: name });

  res.json({ message: 'Environment removed', environments: project.environments });
};

export const toggleEnvironmentRestriction = async (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  const projectId = req.params.id;
  const { restrict } = req.body;

  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  if (!project.environments.includes(name)) {
    return res.status(404).json({ message: 'Environment not found' });
  }

  const currentlyRestricted = project.restrictedEnvironments.includes(name);

  if (restrict && !currentlyRestricted) {
    project.restrictedEnvironments.push(name);
  } else if (!restrict && currentlyRestricted) {
    project.restrictedEnvironments = project.restrictedEnvironments.filter(e => e !== name);
  }

  await project.save();
  res.json({ message: `Environment ${restrict ? 'restricted' : 'unrestricted'}`, restrictedEnvironments: project.restrictedEnvironments });
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
      name: invitation.email.split('@')[0],
      isVerified: true // Invited users are verified by default as they received the email
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

  // Generate JWT for immediate login (using 'id' to match protect middleware)
  const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret');
  
  res.json({ 
    message: 'Welcome to the team!', 
    projectId: invitation.projectId,
    user: { _id: user._id, email: user.email, name: user.name, token: jwtToken }
  });
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  const { id: projectId, memberId } = req.params;
  const { role } = req.body;

  // RBAC Check: Only Admin/Owner can change roles
  const requesterMembership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  if (!requesterMembership || (requesterMembership.role !== 'OWNER' && requesterMembership.role !== 'ADMIN')) {
    return res.status(403).json({ message: 'Forbidden: Only Admins can change roles' });
  }

  const member = await ProjectMember.findByIdAndUpdate(memberId, { role }, { new: true });
  if (!member) return res.status(404).json({ message: 'Member not found' });

  res.json(member);
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  const { id: projectId, memberId } = req.params;

  // RBAC Check: Only Admin/Owner can remove members
  const requesterMembership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  if (!requesterMembership || (requesterMembership.role !== 'OWNER' && requesterMembership.role !== 'ADMIN')) {
    return res.status(403).json({ message: 'Forbidden: Only Admins can remove members' });
  }

  const member = await ProjectMember.findById(memberId);
  if (!member) return res.status(404).json({ message: 'Member not found' });

  if (member.role === 'OWNER') {
    return res.status(400).json({ message: 'Cannot remove the project owner' });
  }

  await ProjectMember.findByIdAndDelete(memberId);
  res.json({ message: 'Member removed from project' });
};

export const deleteApiKey = async (req: AuthRequest, res: Response) => {
  const { id: projectId, keyId } = req.params;

  // RBAC Check
  const requesterMembership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  if (!requesterMembership || (requesterMembership.role !== 'OWNER' && requesterMembership.role !== 'ADMIN')) {
    return res.status(403).json({ message: 'Forbidden: Only Admins can delete API keys' });
  }

  const key = await ApiKey.findOneAndDelete({ _id: keyId, projectId });
  if (!key) return res.status(404).json({ message: 'API Key not found' });

  res.json({ message: 'API Key deleted successfully' });
};

export const rotateKey = async (req: AuthRequest, res: Response) => {
  const { id: projectId, keyId } = req.params;

  // RBAC Check
  const requesterMembership = await ProjectMember.findOne({ projectId, userId: req.user!._id });
  if (!requesterMembership || (requesterMembership.role !== 'OWNER' && requesterMembership.role !== 'ADMIN')) {
    return res.status(403).json({ message: 'Forbidden: Only Admins can rotate API keys' });
  }

  try {
    const { rawKey, apiKey } = await rotateApiKey(keyId);
    res.json({ rawKey, apiKey });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};
