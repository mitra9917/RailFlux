/**
 * M4 #32: edge exposes full OpenAPI /v1 surface; read vs booking split upstream.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, afterEach, before, describe, test } from 'node:test';
import { resetPaymentStubRun } from '../../services/baseline/dist/services/payment-stub.js';
import { signSyntheticJwt } from '@railflux/shared';
import { createPool, pingDatabase } from '@railflux/baseline/db.js';
import { createReadApp } from '../../services/read/dist/app.js';
import { createBookingApp } from '../../services/booking/dist/app.js';
import { createEdgeApp } from '../../services/edge/dist/app.js';
import {
  TC001_FROM,
  TC001_JOURNEY_DATE,
  TC001_TO,
  TC001_TRAIN_RUN_ID,
  TC001_TRAIN_NO,
  TC001_INVENTORY_3A_ID,
} from '../helpers/tc001-fixture.mjs';
import { postBooking, primePaymentStubForSuccess } from '../helpers/booking-http.mjs';

const requireMysql = process.env.EDGE_ROUTING_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

function serviceConfig(mysql, secret) {
  return {
    nodeEnv: 'test',
    port: 0,
    profile: 'optimized',
    syntheticJwtSecret: secret,
    mysql,
  };
}

async function listen(app) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { server, port, origin: `http://127.0.0.1:${port}` };
}

async function jsonFetch(origin, path, { token, method = 'GET' } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${origin}${path}`, { method, headers });
  const body = await res.json();
  return { status: res.status, body };
}

describe('edge routing (integration)', () => {
  let pool;
  let readServer;
  let bookingServer;
  let edgeServer;
  let edgeOrigin;
  let token;
  let fixtureUserId;
  let mysqlAvailable = false;
  const secret = 'edge-routing-test-secret';

  before(async () => {
    const mysql = mysqlConfig();
    pool = createPool({
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: secret,
      mysql,
    });
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireMysql) {
      throw new Error('EDGE_ROUTING_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
    fixtureUserId = userRows[0]?.id;
    if (!fixtureUserId) throw new Error('fixture has no users');

    token = await signSyntheticJwt(secret, { userId: fixtureUserId });
    const cfg = serviceConfig(mysql, secret);

    const read = await listen(createReadApp(cfg, pool));
    readServer = read.server;

    const booking = await listen(createBookingApp(cfg, pool));
    bookingServer = booking.server;

    const edgeApp = createEdgeApp({
      nodeEnv: 'test',
      port: 0,
      readUpstream: read.origin,
      bookingUpstream: booking.origin,
    });
    const edge = await listen(edgeApp);
    edgeServer = edge.server;
    edgeOrigin = edge.origin;
  });

  after(async () => {
    for (const server of [edgeServer, bookingServer, readServer]) {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }
    }
    if (pool) await pool.end();
  });

  function skipUnlessReady(t) {
    if (!mysqlAvailable) {
      t.skip('MySQL not available (run npm run test:edge-routing)');
      return false;
    }
    return true;
  }

  const runId = 'edge-routing';

  afterEach(async () => {
    if (!mysqlAvailable) return;
    await pool.query(
      `UPDATE seat_inventory SET available_seats = initial_seats WHERE id = ?`,
      [TC001_INVENTORY_3A_ID],
    );
    const [bookingRows] = await pool.query(`SELECT id FROM bookings WHERE run_id = ?`, [runId]);
    for (const row of bookingRows) {
      const [outboxRows] = await pool.query(
        `SELECT event_id AS eventId FROM outbox_events WHERE aggregate_id = ?`,
        [row.id],
      );
      for (const o of outboxRows) {
        await pool.query(`DELETE FROM processed_events WHERE event_id = ?`, [o.eventId]);
      }
      await pool.query(`DELETE FROM outbox_events WHERE aggregate_id = ?`, [row.id]);
      await pool.query(`DELETE FROM payments WHERE booking_id = ?`, [row.id]);
      await pool.query(`DELETE FROM booking_passengers WHERE booking_id = ?`, [row.id]);
    }
    await pool.query(`DELETE FROM booking_idempotency WHERE run_id = ?`, [runId]);
    await pool.query(`DELETE FROM bookings WHERE run_id = ?`, [runId]);
    resetPaymentStubRun();
  });

  test('TC-001 read paths via edge', async (t) => {
    if (!skipUnlessReady(t)) return;

    const search = await jsonFetch(
      edgeOrigin,
      `/v1/search?from=${TC001_FROM}&to=${TC001_TO}&date=${TC001_JOURNEY_DATE}`,
      { token },
    );
    assert.equal(search.status, 200);
    assert.ok(search.body.items.some((item) => item.trainNo === TC001_TRAIN_NO));

    const availability = await jsonFetch(
      edgeOrigin,
      `/v1/availability?trainRunId=${TC001_TRAIN_RUN_ID}&class=3A&quota=TATKAL`,
      { token },
    );
    assert.equal(availability.status, 200);
    assert.equal(typeof availability.body.displayedSeats, 'number');
  });

  test('POST and GET booking via edge', async (t) => {
    if (!skipUnlessReady(t)) return;

    await primePaymentStubForSuccess();
    const idempotencyKey = randomUUID();
    const createBody = {
      userId: fixtureUserId,
      inventoryId: TC001_INVENTORY_3A_ID,
      passengers: [{ syntheticName: 'Edge Pax', age: 30 }],
      paymentToken: 'stub-payment-token',
    };

    const created = await postBooking(edgeOrigin, token, idempotencyKey, createBody, runId);
    assert.equal(created.status, 201);
    assert.equal(typeof created.body.bookingId, 'string');

    const got = await jsonFetch(edgeOrigin, `/v1/bookings/${created.body.bookingId}`, { token });
    assert.equal(got.status, 200);
    assert.equal(got.body.bookingId, created.body.bookingId);
    assert.equal(got.body.status, 'CONFIRMED');
  });

  test('edge ready when upstreams are healthy', async (t) => {
    if (!skipUnlessReady(t)) return;
    const res = await fetch(`${edgeOrigin}/health/ready`);
    assert.equal(res.status, 200);
  });
});
