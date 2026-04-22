import express from 'express';
import { fetchTranslations, reportMissingKeys, getProjectConfig } from '../controllers/sdkController';

const router = express.Router();

router.get('/translations', fetchTranslations);
router.get('/config', getProjectConfig);
router.post('/missing-report', reportMissingKeys);

export default router;
