/**
 * TC-005: duplicate retry with same idempotency key/body returns stored terminal result.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import {
  HEADER_IDEMPOTENCY_KEY,
  hashBookingRequest,
  hashIdempotencyKey,
  signSyntheticJwt,
} from '@railflux/shared';
import { createApp } from '../../services/baseline/dist/app.js';
import {
  completeIdempotencyTerminal,
  insertIdempotencyInProgress,
  idempotencyExpiresAt,
  resolveIdempotencyReplay,
} from '../../services/baseline/dist/services/booking-idempotency.js';
import { createPool, pingDatabase } from '../../services/baseline/dist/db.js';
import { TC001_INVENTORY_3A_ID } from '../helpers/tc001-fixture.mjs';

const requireMysql = process.env.IDEMPOTENCY_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

describe('idempotency replay (TC-005)', () => {
  let pool;
  let server;
  let port;
  let token;
  let mysqlAvailable = false;
  let fixtureUserId;
  /** @type {import('@railflux/shared').CreateBookingRequest} */
  let createBody;

  before(async () => {
    const mysql = mysqlConfig();
    const config = {
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: 'idempotency-test-secret',
      mysql,
    };
    pool = createPool(config);
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireMysql) {
      throw new Error('IDEMPOTENCY_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
    fixtureUserId = userRows[0]?.id;
    if (!fixtureUserId) {
      throw new Error('fixture has no users; run npm run db:load');
    }
    createBody = {
      userId: fixtureUserId,
      inventoryId: TC001_INVENTORY_3A_ID,
      passengers: [{ syntheticName: 'Synthetic Pax', age: 28 }],
      paymentToken: 'stub-payment-token',
    };

    token = await signSyntheticJwt(config.syntheticJwtSecret, { userId: fixtureUserId });
    const app = createApp(config, pool);
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
      t.skip('MySQL not available (run npm run test:idempotency-replay)');
      return false;
    }
    return true;
  }

  async function seedTerminalRecord(conn, idempotencyKey) {
    const bookingId = randomUUID();
    const keyHash = hashIdempotencyKey(idempotencyKey);
    const requestHash = hashBookingRequest(createBody);
    const terminal = {
      bookingId,
      status: 'CONFIRMED',
      simulatedPnr: null,
      errorCode: null,
    };

    await conn.query(
      `INSERT INTO bookings
         (id, run_id, user_id, inventory_id, status, seat_count, total_fare, simulated_pnr)
       VALUES (?, 'tc005-run', ?, ?, 'CONFIRMED', 1, 100.00, NULL)`,
      [bookingId, fixtureUserId, TC001_INVENTORY_3A_ID],
    );
    await insertIdempotencyInProgress(conn, {
      idempotencyKeyHash: keyHash,
      runId: 'tc005-run',
      requestHash,
      expiresAt: idempotencyExpiresAt(),
    });
    await completeIdempotencyTerminal(conn, {
      idempotencyKeyHash: keyHash,
      bookingId,
      responseBody: terminal,
    });
    return { keyHash, terminal };
  }

  test('resolveIdempotencyReplay returns stored BookingResult', async (t) => {
    if (!skipUnlessReady(t)) return;
    const conn = await pool.getConnection();
    const idempotencyKey = `tc005-store-${randomUUID()}`;
    try {
      await conn.beginTransaction();
      const { keyHash, terminal } = await seedTerminalRecord(conn, idempotencyKey);
      const requestHash = hashBookingRequest(createBody);

      const first = await resolveIdempotencyReplay(conn, { idempotencyKeyHash: keyHash, requestHash });
      const second = await resolveIdempotencyReplay(conn, { idempotencyKeyHash: keyHash, requestHash });
      assert.equal(first.type, 'replay');
      assert.equal(second.type, 'replay');
      assert.deepEqual(first.body, terminal);
      assert.deepEqual(second.body, terminal);
      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  test('POST /v1/bookings replays 200 for duplicate Idempotency-Key + body (TC-005)', async (t) => {
    if (!skipUnlessReady(t)) return;
    const conn = await pool.getConnection();
    const idempotencyKey = `tc005-http-${randomUUID()}`;
    let terminal;
    try {
      await conn.beginTransaction();
      ({ terminal } = await seedTerminalRecord(conn, idempotencyKey));
      await conn.commit();
    } finally {
      conn.release();
    }

    async function postBooking() {
      const res = await fetch(`http://127.0.0.1:${port}/v1/bookings`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          [HEADER_IDEMPOTENCY_KEY]: idempotencyKey,
        },
        body: JSON.stringify(createBody),
      });
      const body = await res.json();
      return { status: res.status, body };
    }

    const first = await postBooking();
    const second = await postBooking();
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(first.body, terminal);
    assert.deepEqual(second.body, terminal);

    await pool.query('DELETE FROM booking_idempotency WHERE run_id = ?', ['tc005-run']);
    await pool.query('DELETE FROM bookings WHERE run_id = ?', ['tc005-run']);
  });
});
