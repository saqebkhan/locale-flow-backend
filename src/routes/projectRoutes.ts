import express from 'express';
import { createProject, getProjects, getProjectKeys, createNewKey, getProjectDetails, updateProject, inviteMember, getProjectMembers, acceptInvitation, updateMemberRole, removeMember, deleteApiKey, rotateKey, addEnvironment } from '../controllers/projectController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.route('/').post(protect, createProject).get(protect, getProjects);
router.route('/:id').get(protect, getProjectDetails).put(protect, updateProject);
router.post('/:id/environments', protect, addEnvironment);
router.post('/:id/invite', protect, inviteMember);
router.get('/:id/members', protect, getProjectMembers);
router.get('/:id/keys', protect, getProjectKeys);
router.post('/:id/keys', protect, createNewKey);
router.delete('/:id/keys/:keyId', protect, deleteApiKey);
router.post('/:id/keys/:keyId/rotate', protect, rotateKey);

// Member Management
router.put('/:id/members/:memberId', protect, updateMemberRole);
router.delete('/:id/members/:memberId', protect, removeMember);

// Invitation Handling
router.post('/invitations/:token/accept', protect, acceptInvitation);

export default router;
