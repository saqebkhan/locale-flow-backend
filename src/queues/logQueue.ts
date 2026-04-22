import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import MissingTranslation from '../models/MissingTranslation';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});


export const logQueue = new Queue('logQueue', { connection });

const worker = new Worker('logQueue', async job => {
  if (job.name === 'reportMissing') {
    const { projectId, language, key } = job.data;
    await MissingTranslation.findOneAndUpdate(
      { projectId, language, key },
      { $inc: { count: 1 }, lastSeenAt: new Date() },
      { upsert: true }
    );
  }
}, { connection });

worker.on('completed', job => {
  console.log(`Job ${job.id} completed`);
});
