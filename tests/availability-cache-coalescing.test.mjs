/**
 * FT-009 prep: concurrent cache misses for one key coalesce to a single load.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRedisAvailabilityReader } from '../services/read/dist/cache/availability-cache.js';

test('concurrent availability cache misses coalesce to one backend load', async () => {
  let loadCount = 0;
  const query = {
    trainRunId: 'a5012c27-3b3a-4114-bea2-a33ec2bea8d7',
    class: '3A',
    quota: 'TATKAL',
  };

  const pool = {};
  const redisStore = new Map();

  const redis = {
    async get(key) {
      return redisStore.get(key) ?? null;
    },
    async set(key, value, { EX }) {
      redisStore.set(key, value);
      void EX;
    },
  };

  const reader = createRedisAvailabilityReader(pool, redis, {
    loadFromDb: async () => {
      loadCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        trainRunId: query.trainRunId,
        class: query.class,
        quota: query.quota,
        inventoryId: 'c0714d77-5e36-4aeb-a001-dd17aa3809c3',
        displayedSeats: 42,
        freshness: {
          observedAt: new Date().toISOString(),
          authoritative: false,
          cacheStatus: 'BYPASS',
        },
      };
    },
  });

  const results = await Promise.all(
    Array.from({ length: 12 }, () => reader.getAvailability(query)),
  );
  assert.equal(loadCount, 1, 'expected single-flight to bound DB loads');
  assert.ok(results.every((r) => r.freshness.cacheStatus === 'MISS'));
  const observed = results[0].freshness.observedAt;
  assert.ok(results.every((r) => r.freshness.observedAt === observed));
});
