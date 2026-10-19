import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { HEADER_REQUEST_ID } from '@railflux/shared';
import { createApp } from '../services/baseline/dist/app.js';

const baseConfig = {
  nodeEnv: 'test',
  port: 0,
  profile: 'baseline',
  syntheticJwtSecret: 'test-logging-secret',
  mysql: {
    host: '127.0.0.1',
    port: 3307,
    user: 'railflux',
    password: 'railflux',
    database: 'railflux',
  },
};

function mockPool() {
  return {
    async getConnection() {
      return { async ping() {}, release() {} };
    },
  };
}

test('responses include X-Request-Id and accept X-Run-Id', async () => {
  const app = createApp(baseConfig, mockPool());
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/health/live`, {
      headers: { 'X-Run-Id': 'run-2026-pilot' },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get(HEADER_REQUEST_ID), /^[0-9a-f--]{36}$/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
