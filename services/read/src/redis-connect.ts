import { createClient } from 'redis';
import type { DbPool } from '@railflux/baseline/db.js';
import {
  createBypassAvailabilityReader,
  createRedisAvailabilityReader,
  redisClientOptions,
  type AvailabilityReader,
} from './cache/availability-cache.js';

export type ReadRedisConnection = {
  reader: AvailabilityReader;
  isOpen: boolean;
  close: () => Promise<void>;
};

export async function connectAvailabilityCache(
  pool: DbPool,
  redisUrl: string | undefined,
): Promise<ReadRedisConnection> {
  if (!redisUrl) {
    return {
      reader: createBypassAvailabilityReader(pool),
      isOpen: false,
      close: async () => {},
    };
  }

  const redis = createClient(redisClientOptions(redisUrl));
  redis.on('error', () => {
    // Connection errors are handled per-request; avoid crashing the process.
  });

  try {
    await redis.connect();
    return {
      reader: createRedisAvailabilityReader(pool, redis),
      isOpen: true,
      close: async () => {
        if (redis.isOpen) {
          await redis.quit();
        }
      },
    };
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: 'redis_unreachable',
        service: 'read',
        url: redisUrl,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    try {
      if (redis.isOpen) {
        await redis.disconnect();
      }
    } catch {
      // ignore
    }
    return {
      reader: createBypassAvailabilityReader(pool),
      isOpen: false,
      close: async () => {},
    };
  }
}
