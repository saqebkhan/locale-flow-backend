import express from 'express';
import { createProject, getProjects, getProjectKeys, createNewKey, getProjectDetails, updateProject, inviteMember, getProjectMembers, acceptInvitation, updateMemberRole, removeMember } from '../controllers/projectController';

const router = express.Router();

router.route('/').post(createProject).get(getProjects);
router.route('/:id').get(getProjectDetails).put(updateProject);
router.post('/:id/invite', inviteMember);
router.get('/:id/members', getProjectMembers);
router.get('/:id/keys', getProjectKeys);
router.post('/:id/keys', createNewKey);

// Member Management
router.put('/:id/members/:memberId', updateMemberRole);
router.delete('/:id/members/:memberId', removeMember);

// Invitation Handling
router.post('/invitations/:token/accept', acceptInvitation);

export default router;
