import express from 'express';
import { createProject, getProjects, getProjectKeys, createNewKey } from '../controllers/projectController';

const router = express.Router();

router.route('/').post(createProject).get(getProjects);
router.get('/:id/keys', getProjectKeys);
router.post('/:id/keys', createNewKey);

export default router;
