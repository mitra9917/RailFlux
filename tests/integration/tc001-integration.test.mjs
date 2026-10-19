/**
 * Catalog TC-001: search and availability contract tests against live MySQL + baseline app.
 * Run via `npm run test:tc001` (CI database-smoke job). Not part of default `npm test`.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { signSyntheticJwt } from '@railflux/shared';
import { createApp } from '../../services/baseline/dist/app.js';
import { createPool, pingDatabase } from '../../services/baseline/dist/db.js';
import {
  TC001_FROM,
  TC001_JOURNEY_DATE,
  TC001_TO,
  TC001_TRAIN_RUN_ID,
  TC001_TRAIN_NO,
  TC001_USER_ID,
} from '../helpers/tc001-fixture.mjs';

const requireMysql = process.env.TC001_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

function serviceConfig(mysql) {
  return {
    nodeEnv: 'test',
    port: 0,
    profile: 'baseline',
    syntheticJwtSecret: process.env.SYNTHETIC_JWT_SECRET ?? 'tc001-test-secret',
    mysql,
  };
}

function assertBaselineFreshness(freshness) {
  assert.equal(typeof freshness.observedAt, 'string');
  assert.doesNotThrow(() => new Date(freshness.observedAt).toISOString());
  assert.equal(freshness.authoritative, false);
  assert.equal(freshness.cacheStatus, 'BYPASS');
}

async function jsonFetch(port, path, { token, method = 'GET' } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers });
  const body = await res.json();
  return { status: res.status, body };
}

describe('TC-001 baseline read APIs (integration)', () => {
  /** @type {import('../../services/baseline/dist/db.js').DbPool | undefined} */
  let pool;
  /** @type {import('node:http').Server | undefined} */
  let server;
  let port;
  let token;
  let mysqlAvailable = false;

  before(async () => {
    const mysql = mysqlConfig();
    pool = createPool(serviceConfig(mysql));
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable) {
      if (requireMysql) {
        throw new Error(
          `TC001_INTEGRATION=1 but MySQL is unavailable at ${mysql.host}:${mysql.port}`,
        );
      }
      return;
    }

    token = await signSyntheticJwt(serviceConfig(mysql).syntheticJwtSecret, {
      userId: TC001_USER_ID,
    });
    const app = createApp(serviceConfig(mysql), pool);
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
    if (pool) await pool.end();
  });

  /** @returns {boolean} false when test was skipped */
  function skipUnlessReady(t) {
    if (!mysqlAvailable) {
      t.skip('MySQL not available (run npm run test:tc001 with DB up)');
      return false;
    }
    return true;
  }

  test('search: valid route returns contract-compliant items and freshness', async (t) => {
    if (!skipUnlessReady(t)) return;
    const q = new URLSearchParams({
      from: TC001_FROM,
      to: TC001_TO,
      date: TC001_JOURNEY_DATE,
    });
    const { status, body } = await jsonFetch(port, `/v1/search?${q}`, { token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.length >= 1);
    const run = body.items.find((item) => item.trainRunId === TC001_TRAIN_RUN_ID);
    assert.ok(run, 'expected seeded train run in search results');
    assert.equal(run.trainNo, TC001_TRAIN_NO);
    assert.equal(run.date, TC001_JOURNEY_DATE);
    assert.equal(run.from, TC001_FROM);
    assert.equal(run.to, TC001_TO);
    assert.match(run.name, /RailFlux Express/);
    assertBaselineFreshness(body.freshness);
  });

  test('search: invalid query returns 400 VALIDATION_ERROR', async (t) => {
    if (!skipUnlessReady(t)) return;
    const q = new URLSearchParams({ from: 'bad', to: TC001_TO, date: TC001_JOURNEY_DATE });
    const { status, body } = await jsonFetch(port, `/v1/search?${q}`, { token });
    assert.equal(status, 400);
    assert.equal(body.errorCode, 'VALIDATION_ERROR');
    assert.equal(typeof body.message, 'string');
  });

  test('search: missing bearer returns 401 UNAUTHORIZED', async (t) => {
    if (!skipUnlessReady(t)) return;
    const q = new URLSearchParams({
      from: TC001_FROM,
      to: TC001_TO,
      date: TC001_JOURNEY_DATE,
    });
    const { status, body } = await jsonFetch(port, `/v1/search?${q}`);
    assert.equal(status, 401);
    assert.equal(body.errorCode, 'UNAUTHORIZED');
  });

  test('availability: valid bucket returns displayedSeats and BYPASS freshness', async (t) => {
    if (!skipUnlessReady(t)) return;
    const q = new URLSearchParams({
      trainRunId: TC001_TRAIN_RUN_ID,
      class: '3A',
      quota: 'TATKAL',
    });
    const { status, body } = await jsonFetch(port, `/v1/availability?${q}`, { token });
    assert.equal(status, 200);
    assert.equal(body.trainRunId, TC001_TRAIN_RUN_ID);
    assert.equal(body.class, '3A');
    assert.equal(body.quota, 'TATKAL');
    assert.equal(typeof body.displayedSeats, 'number');
    assert.ok(body.displayedSeats >= 0);
    assertBaselineFreshness(body.freshness);
  });

  test('availability: invalid class returns 400 VALIDATION_ERROR', async (t) => {
    if (!skipUnlessReady(t)) return;
    const q = new URLSearchParams({
      trainRunId: TC001_TRAIN_RUN_ID,
      class: '1A',
      quota: 'TATKAL',
    });
    const { status, body } = await jsonFetch(port, `/v1/availability?${q}`, { token });
    assert.equal(status, 400);
    assert.equal(body.errorCode, 'VALIDATION_ERROR');
  });

  test('availability: unknown train run returns 404 NOT_FOUND', async (t) => {
    if (!skipUnlessReady(t)) return;
    const q = new URLSearchParams({
      trainRunId: '00000000-0000-4000-8000-000000000000',
      class: '3A',
      quota: 'TATKAL',
    });
    const { status, body } = await jsonFetch(port, `/v1/availability?${q}`, { token });
    assert.equal(status, 404);
    assert.equal(body.errorCode, 'NOT_FOUND');
  });
});
