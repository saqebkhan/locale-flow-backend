import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { apiLimiter, sdkLimiter } from './middleware/rateLimiter.js';
import { apiKeyProtect } from './middleware/apiKeyAuth.js';
import { protect } from './middleware/auth.js';
import { setCacheHeaders } from './middleware/cacheHeaders.js';
import { timingMiddleware } from './middleware/timing.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import sdkRoutes from './routes/sdkRoutes.js';
import translationRoutes from './routes/translationRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(timingMiddleware);

// Dashboard APIs
app.use('/api/auth', authRoutes);
app.use('/api/projects', protect, projectRoutes);
app.use('/api/translations', protect, translationRoutes);
app.use('/api/invitations', invitationRoutes);

// SDK APIs (Public with API Key)
app.use('/api/v1/sdk', sdkLimiter, apiKeyProtect, setCacheHeaders(300), sdkRoutes);

export default app;
