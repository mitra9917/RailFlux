import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { HEALTH_LIVE_PATH, HEALTH_READY_PATH } from '@railflux/shared';
import { createApp } from '../services/baseline/dist/app.js';

const baseConfig = {
  nodeEnv: 'test',
  port: 0,
  profile: 'baseline',
  syntheticJwtSecret: 'test-health-secret',
  mysql: {
    host: '127.0.0.1',
    port: 3307,
    user: 'railflux',
    password: 'railflux',
    database: 'railflux',
  },
};

function mockPool(dbOk) {
  return {
    async getConnection() {
      if (!dbOk) {
        throw new Error('ECONNREFUSED');
      }
      return {
        async ping() {},
        release() {},
      };
    },
  };
}

async function withServer(pool, fn) {
  const app = createApp(baseConfig, pool);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(port);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function getJson(port, path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const body = await res.json();
  return { status: res.status, body, cacheControl: res.headers.get('cache-control') };
}

test('liveness always 200 ok', async () => {
  await withServer(mockPool(false), async (port) => {
    const { status, body, cacheControl } = await getJson(port, HEALTH_LIVE_PATH);
    assert.equal(status, 200);
    assert.deepEqual(body, { status: 'ok' });
    assert.equal(cacheControl, 'no-store');
  });
});

test('readiness 200 when MySQL ping succeeds', async () => {
  await withServer(mockPool(true), async (port) => {
    const { status, body } = await getJson(port, HEALTH_READY_PATH);
    assert.equal(status, 200);
    assert.deepEqual(body, { status: 'ok' });
  });
});

test('readiness 503 fail when MySQL unavailable', async () => {
  await withServer(mockPool(false), async (port) => {
    const { status, body } = await getJson(port, HEALTH_READY_PATH);
    assert.equal(status, 503);
    assert.deepEqual(body, { status: 'fail' });
  });
});
