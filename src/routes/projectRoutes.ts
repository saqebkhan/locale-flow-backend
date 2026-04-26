import express from 'express';
import { createProject, getProjects, getProjectKeys, createNewKey, getProjectDetails, updateProject, inviteMember, getProjectMembers, acceptInvitation, updateMemberRole, removeMember, deleteApiKey, rotateKey } from '../controllers/projectController';
import { auth } from '../middleware/auth';

const router = express.Router();

router.route('/').post(auth, createProject).get(auth, getProjects);
router.route('/:id').get(auth, getProjectDetails).put(auth, updateProject);
router.post('/:id/invite', auth, inviteMember);
router.get('/:id/members', auth, getProjectMembers);
router.get('/:id/keys', auth, getProjectKeys);
router.post('/:id/keys', auth, createNewKey);
router.delete('/:id/keys/:keyId', auth, deleteApiKey);
router.post('/:id/keys/:keyId/rotate', auth, rotateKey);

// Member Management
router.put('/:id/members/:memberId', auth, updateMemberRole);
router.delete('/:id/members/:memberId', auth, removeMember);

// Invitation Handling
router.post('/invitations/:token/accept', auth, acceptInvitation);

export default router;
