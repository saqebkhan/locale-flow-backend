import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { apiLimiter, sdkLimiter } from './middleware/rateLimiter';
import { apiKeyProtect } from './middleware/apiKeyAuth';
import { protect } from './middleware/auth';
import { setCacheHeaders } from './middleware/cacheHeaders';

// Routes
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import sdkRoutes from './routes/sdkRoutes';
import translationRoutes from './routes/translationRoutes';

dotenv.config();

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

// Dashboard APIs
app.use('/api/auth', authRoutes);
app.use('/api/projects', protect, projectRoutes);
app.use('/api/translations', protect, translationRoutes);

// SDK APIs (Public with API Key)
app.use('/api/v1/sdk', sdkLimiter, apiKeyProtect, setCacheHeaders(300), sdkRoutes);

export default app;
