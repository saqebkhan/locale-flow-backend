import express from 'express';
import { createProject, getProjects, getProjectKeys, createNewKey, getProjectDetails, updateProject } from '../controllers/projectController';

const router = express.Router();

router.route('/').post(createProject).get(getProjects);
router.route('/:id').get(getProjectDetails).put(updateProject);
router.get('/:id/keys', getProjectKeys);
router.post('/:id/keys', createNewKey);

export default router;
