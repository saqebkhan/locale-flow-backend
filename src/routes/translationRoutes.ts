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
  rejectTranslation,
  bulkUpload,
  getProjectPendingStats
} from '../controllers/translationController.js';

const router = express.Router();

router.post('/', createTranslation);
router.get('/project/:projectId', getTranslationsForProject);
router.get('/project/:projectId/pending-stats', getProjectPendingStats);
router.put('/:id', updateTranslation);
router.delete('/:id', deleteTranslation);
router.put('/project/:projectId/key/:oldKey', updateKey);
router.delete('/project/:projectId/key/:key', deleteKey);
router.post('/snapshot', createSnapshotHandler);
router.post('/rollback', rollbackHandler);
router.post('/ai-translate', aiTranslate);
router.post('/:id/restore', restoreTranslation);
router.post('/:id/approve', approveTranslation);
router.post('/:id/reject', rejectTranslation);
router.post('/bulk-upload', bulkUpload);

export default router;
