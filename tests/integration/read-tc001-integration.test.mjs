/**
 * TC-001 read paths on optimized read service (independent of baseline port).
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { signSyntheticJwt } from '@railflux/shared';
import { createPool, pingDatabase } from '@railflux/baseline/db.js';
import { createReadApp } from '../../services/read/dist/app.js';
import {
  TC001_FROM,
  TC001_JOURNEY_DATE,
  TC001_TO,
  TC001_TRAIN_RUN_ID,
  TC001_TRAIN_NO,
  TC001_USER_ID,
} from '../helpers/tc001-fixture.mjs';

const requireMysql = process.env.READ_TC001_INTEGRATION === '1';

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
    syntheticJwtSecret: process.env.SYNTHETIC_JWT_SECRET ?? 'read-tc001-test-secret',
    mysql,
  };
}

function assertBaselineFreshness(freshness) {
  assert.equal(typeof freshness.observedAt, 'string');
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

describe('TC-001 read service (integration)', () => {
  let pool;
  let server;
  let port;
  let token;
  let mysqlAvailable = false;

  before(async () => {
    const mysql = mysqlConfig();
    pool = createPool({
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: readConfig(mysql).syntheticJwtSecret,
      mysql,
    });
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireMysql) {
      throw new Error('READ_TC001_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    token = await signSyntheticJwt(readConfig(mysql).syntheticJwtSecret, { userId: TC001_USER_ID });
    const app = createReadApp(readConfig(mysql), pool);
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

  function skipUnlessReady(t) {
    if (!mysqlAvailable) {
      t.skip('MySQL not available (run npm run test:read-tc001)');
      return false;
    }
    return true;
  }

  test('search and availability succeed on read service', async (t) => {
    if (!skipUnlessReady(t)) return;

    const search = await jsonFetch(
      port,
      `/v1/search?from=${TC001_FROM}&to=${TC001_TO}&date=${TC001_JOURNEY_DATE}`,
      { token },
    );
    assert.equal(search.status, 200);
    assert.ok(search.body.items.some((item) => item.trainNo === TC001_TRAIN_NO));

    const availability = await jsonFetch(
      port,
      `/v1/availability?trainRunId=${TC001_TRAIN_RUN_ID}&class=3A&quota=TATKAL`,
      { token },
    );
    assert.equal(availability.status, 200);
    assert.equal(typeof availability.body.displayedSeats, 'number');
    assertBaselineFreshness(availability.body.freshness);
  });

  test('bookings route is not mounted on read service', async (t) => {
    if (!skipUnlessReady(t)) return;
    const res = await fetch(`http://127.0.0.1:${port}/v1/bookings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'Idempotency-Key': 'read-service-no-bookings-route',
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 404);
  });
});
