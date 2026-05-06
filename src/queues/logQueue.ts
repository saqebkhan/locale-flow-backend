import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import MissingTranslation from '../models/MissingTranslation';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  lazyConnect: true, // Don't connect immediately
  enableOfflineQueue: false, // Don't queue commands if offline
  retryStrategy: (times) => {
    if (times > 3) {
      // Stop retrying after 3 attempts in development
      return null;
    }
    return Math.min(times * 100, 3000);
  }
});

connection.on('error', (err) => {
  // Only log if it's not a connection refused error, or log it once
  if (err.code !== 'ECONNREFUSED') {
    console.error('Redis Error:', err.message);
  }
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
