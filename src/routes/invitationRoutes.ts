import express from 'express';
import { getInvitation, joinByInvitation } from '../controllers/projectController.js';

const router = express.Router();

router.get('/:token', getInvitation);
router.post('/:token/join', joinByInvitation);

export default router;
