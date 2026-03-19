import Redis from 'ioredis';
import { logger } from '@/utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisUnavailableLogged = false;

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 300,
  commandTimeout: 500,
  enableOfflineQueue: false,
  autoResendUnfulfilledCommands: false,
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
});

redis.on('connect', () => {
  redisUnavailableLogged = false;
  logger.info('Redis connected');
});

redis.on('error', (err: NodeJS.ErrnoException) => {
  if (!redisUnavailableLogged) {
    redisUnavailableLogged = true;
    logger.warn('Redis unavailable, falling back to database-only mode', {
      code: err.code,
      message: err.message,
    });
  }
  logger.debug('Redis error:', err);
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (error) {
    logger.warn('Redis connect skipped, continuing without cache', error);
  }
}
