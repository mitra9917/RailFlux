/**
 * TC-002: availability cache miss then hit with freshness metadata (optimized read path).
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { createClient } from 'redis';
import { signSyntheticJwt } from '@railflux/shared';
import { createPool, pingDatabase } from '@railflux/baseline/db.js';
import {
  availabilityCacheKey,
  createRedisAvailabilityReader,
  redisClientOptions,
} from '../../services/read/dist/cache/availability-cache.js';
import { createReadApp } from '../../services/read/dist/app.js';
import {
  TC001_TRAIN_RUN_ID,
  TC001_USER_ID,
} from '../helpers/tc001-fixture.mjs';

const requireRedis = process.env.TC002_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

function readConfig(mysql) {
  return {
    nodeEnv: 'test',
    port: 0,
    profile: 'optimized',
    syntheticJwtSecret: process.env.SYNTHETIC_JWT_SECRET ?? 'tc002-test-secret',
    redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    mysql,
  };
}

async function jsonFetch(port, path, token) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return { status: res.status, body };
}

describe('TC-002 availability cache (integration)', () => {
  let pool;
  let redis;
  let server;
  let port;
  let token;
  let mysqlAvailable = false;
  let redisAvailable = false;
  const availabilityPath = `/v1/availability?trainRunId=${TC001_TRAIN_RUN_ID}&class=3A&quota=TATKAL`;

  before(async () => {
    const mysql = mysqlConfig();
    const cfg = readConfig(mysql);
    pool = createPool({
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: cfg.syntheticJwtSecret,
      mysql,
    });
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireRedis) {
      throw new Error('TC002_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    redis = createClient(redisClientOptions(cfg.redisUrl));
    try {
      await redis.connect();
      redisAvailable = true;
    } catch {
      redisAvailable = false;
      if (requireRedis) {
        throw new Error(`TC002_INTEGRATION=1 but Redis is unavailable at ${cfg.redisUrl}`);
      }
      return;
    }

    await redis.del(
      availabilityCacheKey({ trainRunId: TC001_TRAIN_RUN_ID, class: '3A', quota: 'TATKAL' }),
    );

    token = await signSyntheticJwt(cfg.syntheticJwtSecret, { userId: TC001_USER_ID });
    const reader = createRedisAvailabilityReader(pool, redis);
    const app = createReadApp(cfg, pool, { availabilityReader: reader });
    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (redis?.isOpen) await redis.quit();
    if (pool) await pool.end();
  });

  function skipUnlessReady(t) {
    if (!mysqlAvailable || !redisAvailable) {
      t.skip('MySQL/Redis not available (run npm run test:tc002-cache)');
      return false;
    }
    return true;
  }

  test('first read misses cache, second read hits with same observedAt', async (t) => {
    if (!skipUnlessReady(t)) return;

    const first = await jsonFetch(port, availabilityPath, token);
    assert.equal(first.status, 200);
    assert.equal(typeof first.body.displayedSeats, 'number');
    assert.equal(first.body.freshness.authoritative, false);
    assert.equal(first.body.freshness.cacheStatus, 'MISS');
    assert.equal(typeof first.body.freshness.observedAt, 'string');

    const second = await jsonFetch(port, availabilityPath, token);
    assert.equal(second.status, 200);
    assert.equal(second.body.freshness.cacheStatus, 'HIT');
    assert.equal(second.body.freshness.observedAt, first.body.freshness.observedAt);
    assert.equal(second.body.displayedSeats, first.body.displayedSeats);
  });
});
