import express from 'express';
import { 
  createTranslation, 
  getTranslationsForProject, 
  deleteTranslation, 
  updateTranslation,
  updateKey,
  deleteKey,
  createSnapshotHandler, 
  rollbackHandler 
} from '../controllers/translationController';

const router = express.Router();

router.post('/', createTranslation);
router.get('/project/:projectId', getTranslationsForProject);
router.put('/:id', updateTranslation);
router.delete('/:id', deleteTranslation);
router.put('/project/:projectId/key/:oldKey', updateKey);
router.delete('/project/:projectId/key/:key', deleteKey);
router.post('/snapshot', createSnapshotHandler);
router.post('/rollback', rollbackHandler);

export default router;
