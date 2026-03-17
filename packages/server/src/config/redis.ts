import Redis from 'ioredis';
import { logger } from '@/utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', err => logger.error('Redis error:', err));

export async function connectRedis(): Promise<void> {
  await redis.connect();
}
