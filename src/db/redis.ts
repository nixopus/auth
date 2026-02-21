import { Redis } from 'ioredis';
import { config } from '../config.js';

let redisInstance: Redis | null = null;

function getRedis(): Redis | null {
  if (!config.redisUrl) {
    return null;
  }
  if (!redisInstance) {
    redisInstance = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisInstance.on('error', (err: Error) => {
      console.error('[redis] connection error:', err.message);
    });

    redisInstance.connect().catch((err: Error) => {
      console.error('[redis] initial connect failed:', err.message);
    });
  }
  return redisInstance;
}

export const redis = getRedis();
