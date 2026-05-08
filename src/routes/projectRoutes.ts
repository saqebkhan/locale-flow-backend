import express from 'express';
import { createProject, getProjects, getProjectKeys, createNewKey, getProjectDetails, updateProject, inviteMember, getProjectMembers, acceptInvitation, updateMemberRole, removeMember, deleteApiKey, rotateKey, addEnvironment, removeEnvironment, toggleEnvironmentRestriction, getMissingKeys, getContentGaps, getKeyMissingEnvironments, duplicateKeyToEnvironment } from '../controllers/projectController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/').post(protect, createProject).get(protect, getProjects);
router.route('/:id').get(protect, getProjectDetails).put(protect, updateProject);
router.post('/:id/environments', protect, addEnvironment);
router.delete('/:id/environments/:name', protect, removeEnvironment);
router.put('/:id/environments/:name/restrict', protect, toggleEnvironmentRestriction);
router.post('/:id/invite', protect, inviteMember);
router.get('/:id/members', protect, getProjectMembers);
router.get('/:id/keys', protect, getProjectKeys);
router.post('/:id/keys', protect, createNewKey);
router.delete('/:id/keys/:keyId', protect, deleteApiKey);
router.post('/:id/keys/:keyId/rotate', protect, rotateKey);
router.get('/:id/missing-keys', protect, getMissingKeys);
router.get('/:id/content-gaps', protect, getContentGaps);
router.get('/:id/key-missing-envs', protect, getKeyMissingEnvironments);
router.post('/:id/duplicate-key', protect, duplicateKeyToEnvironment);

// Member Management
router.put('/:id/members/:memberId', protect, updateMemberRole);
router.delete('/:id/members/:memberId', protect, removeMember);

// Invitation Handling
router.post('/invitations/:token/accept', protect, acceptInvitation);

export default router;
