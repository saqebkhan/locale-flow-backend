import express from 'express';
import { 
  createTranslation, 
  getTranslationsForProject, 
  deleteTranslation, 
  updateTranslation,
  updateKey,
  deleteKey,
  createSnapshotHandler, 
  rollbackHandler,
  aiTranslate,
  restoreTranslation,
  approveTranslation,
  bulkUpload
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
router.post('/ai-translate', aiTranslate);
router.post('/:id/restore', restoreTranslation);
router.post('/:id/approve', approveTranslation);
router.post('/bulk-upload', bulkUpload);

export default router;
