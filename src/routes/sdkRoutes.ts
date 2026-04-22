import express from 'express';
import { fetchTranslations, reportMissingKeys } from '../controllers/sdkController';

const router = express.Router();

router.get('/translations', fetchTranslations);
router.post('/missing-report', reportMissingKeys);

export default router;
