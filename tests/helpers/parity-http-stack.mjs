import { createServer } from 'node:http';
import { createApp } from '../../services/baseline/dist/app.js';
import { createReadApp } from '../../services/read/dist/app.js';
import { createBookingApp } from '../../services/booking/dist/app.js';
import { createEdgeApp } from '../../services/edge/dist/app.js';

async function listen(app) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { server, origin: `http://127.0.0.1:${port}` };
}

export async function createBaselineAndOptimizedStacks(pool, mysql, syntheticJwtSecret) {
  const baselineCfg = {
    nodeEnv: 'test',
    port: 0,
    profile: 'baseline',
    syntheticJwtSecret,
    mysql,
  };
  const optimizedCfg = {
    nodeEnv: 'test',
    port: 0,
    profile: 'optimized',
    syntheticJwtSecret,
    mysql,
  };

  const baseline = await listen(createApp(baselineCfg, pool));
  const read = await listen(createReadApp(optimizedCfg, pool));
  const booking = await listen(createBookingApp(optimizedCfg, pool));
  const edge = await listen(
    createEdgeApp({
      nodeEnv: 'test',
      port: 0,
      readUpstream: read.origin,
      bookingUpstream: booking.origin,
    }),
  );

  async function close() {
    for (const server of [edge.server, booking.server, read.server, baseline.server]) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  return {
    baselineOrigin: baseline.origin,
    optimizedOrigin: edge.origin,
    close,
  };
}

export async function jsonFetch(origin, path, { token, method = 'GET' } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${origin}${path}`, { method, headers });
  const body = await res.json();
  return { status: res.status, body };
}
