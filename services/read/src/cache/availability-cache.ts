import type { Availability, AvailabilityQuery } from '@railflux/shared';
import type { DbPool } from '@railflux/baseline/db.js';
import { getAvailability } from '@railflux/baseline/services/get-availability.js';

/** Minimal Redis surface for cache-aside (keeps tests and types simple). */
export type AvailabilityRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
};

const KEY_PREFIX = 'v1:availability:';
const BASE_TTL_SECONDS = 5;
const TTL_JITTER_RATIO = 0.2;
const REDIS_COMMAND_TIMEOUT_MS = 100;

type CachedPayload = {
  trainRunId: string;
  class: Availability['class'];
  quota: Availability['quota'];
  displayedSeats: number;
  observedAt: string;
};

export function availabilityCacheKey(query: AvailabilityQuery): string {
  return `${KEY_PREFIX}${query.trainRunId}:${query.class}:${query.quota}`;
}

function ttlWithJitterSeconds(): number {
  const jitter = 1 + (Math.random() * 2 - 1) * TTL_JITTER_RATIO;
  return Math.max(1, Math.round(BASE_TTL_SECONDS * jitter));
}

function withFreshness(
  payload: CachedPayload,
  cacheStatus: 'HIT' | 'MISS',
): Availability {
  return {
    trainRunId: payload.trainRunId,
    class: payload.class,
    quota: payload.quota,
    displayedSeats: payload.displayedSeats,
    freshness: {
      observedAt: payload.observedAt,
      authoritative: false,
      cacheStatus,
    },
  };
}

async function redisGet(client: AvailabilityRedis, key: string): Promise<string | null> {
  return client.get(key);
}

async function redisSetEx(
  client: AvailabilityRedis,
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  await client.set(key, value, { EX: ttlSeconds });
}

export type AvailabilityReader = {
  getAvailability(query: AvailabilityQuery): Promise<Availability>;
};

/** DB-only path (baseline semantics: `cacheStatus=BYPASS`). */
export function createBypassAvailabilityReader(pool: DbPool): AvailabilityReader {
  return {
    getAvailability: (query) => getAvailability(pool, query),
  };
}

type AvailabilityDbLoader = (pool: DbPool, query: AvailabilityQuery) => Promise<Availability>;

async function loadAvailabilityPayload(
  pool: DbPool,
  redis: AvailabilityRedis,
  query: AvailabilityQuery,
  key: string,
  loadFromDb: AvailabilityDbLoader,
): Promise<CachedPayload> {
  const fromDb = await loadFromDb(pool, query);
  const observedAt = new Date().toISOString();
  const payload: CachedPayload = {
    trainRunId: fromDb.trainRunId,
    class: fromDb.class,
    quota: fromDb.quota,
    displayedSeats: fromDb.displayedSeats,
    observedAt,
  };

  try {
    await redisSetEx(redis, key, JSON.stringify(payload), ttlWithJitterSeconds());
  } catch {
    // Best-effort cache populate; response still reflects a miss.
  }

  return payload;
}

export type RedisAvailabilityReaderOptions = {
  loadFromDb?: AvailabilityDbLoader;
};

/** Cache-aside advisory availability; booking path must not use this reader. */
export function createRedisAvailabilityReader(
  pool: DbPool,
  redis: AvailabilityRedis,
  options: RedisAvailabilityReaderOptions = {},
): AvailabilityReader {
  const loadFromDb = options.loadFromDb ?? getAvailability;
  /** Single-flight per key: concurrent misses share one DB load (FT-009). */
  const inflightMiss = new Map<string, Promise<CachedPayload>>();

  async function coalescedMissLoad(
    query: AvailabilityQuery,
    key: string,
  ): Promise<CachedPayload> {
    let pending = inflightMiss.get(key);
    if (!pending) {
      pending = loadAvailabilityPayload(pool, redis, query, key, loadFromDb).finally(() => {
        inflightMiss.delete(key);
      });
      inflightMiss.set(key, pending);
    }
    return pending;
  }

  return {
    async getAvailability(query: AvailabilityQuery): Promise<Availability> {
      const key = availabilityCacheKey(query);
      try {
        const cached = await redisGet(redis, key);
        if (cached) {
          const payload = JSON.parse(cached) as CachedPayload;
          return withFreshness(payload, 'HIT');
        }
      } catch {
        return getAvailability(pool, query);
      }

      const payload = await coalescedMissLoad(query, key);
      return withFreshness(payload, 'MISS');
    },
  };
}

export function redisClientOptions(redisUrl: string) {
  return {
    url: redisUrl,
    socket: {
      connectTimeout: REDIS_COMMAND_TIMEOUT_MS,
    },
  };
}
