import express from 'express';
import { createTranslation, getTranslationsForProject, deleteTranslation, createSnapshotHandler, rollbackHandler } from '../controllers/translationController';

const router = express.Router();

router.post('/', createTranslation);
router.get('/project/:projectId', getTranslationsForProject);
router.delete('/:id', deleteTranslation);
router.post('/snapshot', createSnapshotHandler);
router.post('/rollback', rollbackHandler);

export default router;
