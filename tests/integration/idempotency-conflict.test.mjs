/**
 * TC-006: same key + different body → 409 without mutation.
 * In-flight duplicate (same key + body) → 425 BookingInProgress.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import {
  DEFAULT_BOOKING_RETRY_AFTER_MS,
  HEADER_IDEMPOTENCY_KEY,
  hashBookingRequest,
  hashIdempotencyKey,
  signSyntheticJwt,
} from '@railflux/shared';
import { createApp } from '../../services/baseline/dist/app.js';
import {
  completeIdempotencyTerminal,
  getIdempotencyRecord,
  insertIdempotencyInProgress,
  idempotencyExpiresAt,
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

describe('idempotency conflict and in-flight (TC-006)', () => {
  let pool;
  let server;
  let port;
  let token;
  let mysqlAvailable = false;
  let fixtureUserId;
  let baseBody;

  before(async () => {
    const mysql = mysqlConfig();
    const config = {
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: 'idempotency-conflict-test',
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
    if (!fixtureUserId) throw new Error('fixture has no users');

    baseBody = {
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
      t.skip('MySQL not available (run npm run test:idempotency-conflict)');
      return false;
    }
    return true;
  }

  async function postBooking(idempotencyKey, body) {
    const res = await fetch(`http://127.0.0.1:${port}/v1/bookings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        [HEADER_IDEMPOTENCY_KEY]: idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  test('TC-006: same key and different body returns 409 without mutating store', async (t) => {
    if (!skipUnlessReady(t)) return;
    const idempotencyKey = `tc006-${randomUUID()}`;
    const keyHash = hashIdempotencyKey(idempotencyKey);
    const originalHash = hashBookingRequest(baseBody);
    const bookingId = randomUUID();
    const terminal = {
      bookingId,
      status: 'CONFIRMED',
      simulatedPnr: null,
      errorCode: null,
    };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO bookings
           (id, run_id, user_id, inventory_id, status, seat_count, total_fare, simulated_pnr)
         VALUES (?, 'tc006-run', ?, ?, 'CONFIRMED', 1, 100.00, NULL)`,
        [bookingId, fixtureUserId, TC001_INVENTORY_3A_ID],
      );
      await insertIdempotencyInProgress(conn, {
        idempotencyKeyHash: keyHash,
        runId: 'tc006-run',
        requestHash: originalHash,
        expiresAt: idempotencyExpiresAt(),
      });
      await completeIdempotencyTerminal(conn, {
        idempotencyKeyHash: keyHash,
        bookingId,
        responseBody: terminal,
      });
      await conn.commit();
    } finally {
      conn.release();
    }

    const before = await getIdempotencyRecord(pool, keyHash);
    const altBody = {
      ...baseBody,
      paymentToken: 'different-payment-token-xx',
    };
    const { status, body } = await postBooking(idempotencyKey, altBody);
    assert.equal(status, 409);
    assert.equal(body.errorCode, 'IDEMPOTENCY_CONFLICT');

    const after = await getIdempotencyRecord(pool, keyHash);
    assert.equal(after.requestHash, before.requestHash);
    assert.deepEqual(after.responseBody, before.responseBody);

    await pool.query('DELETE FROM booking_idempotency WHERE run_id = ?', ['tc006-run']);
    await pool.query('DELETE FROM bookings WHERE run_id = ?', ['tc006-run']);
  });

  test('in-flight duplicate returns 425 BookingInProgress', async (t) => {
    if (!skipUnlessReady(t)) return;
    const idempotencyKey = `tc006-inflight-${randomUUID()}`;
    const keyHash = hashIdempotencyKey(idempotencyKey);
    const requestHash = hashBookingRequest(baseBody);
    const bookingId = randomUUID();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO bookings
           (id, run_id, user_id, inventory_id, status, seat_count, total_fare, simulated_pnr)
         VALUES (?, 'tc006-inflight', ?, ?, 'RECEIVED', 1, 100.00, NULL)`,
        [bookingId, fixtureUserId, TC001_INVENTORY_3A_ID],
      );
      await conn.query(
        `INSERT INTO booking_idempotency
           (idempotency_key_hash, run_id, request_hash, status, booking_id, response_body, expires_at)
         VALUES (?, 'tc006-inflight', ?, 'IN_PROGRESS', ?, NULL, ?)`,
        [keyHash, requestHash, bookingId, idempotencyExpiresAt()],
      );
      await conn.commit();
    } finally {
      conn.release();
    }

    const { status, body } = await postBooking(idempotencyKey, baseBody);
    assert.equal(status, 425);
    assert.equal(body.bookingId, bookingId);
    assert.equal(body.status, 'RECEIVED');
    assert.equal(body.retryAfterMs, DEFAULT_BOOKING_RETRY_AFTER_MS);

    await pool.query('DELETE FROM booking_idempotency WHERE run_id = ?', ['tc006-inflight']);
    await pool.query('DELETE FROM bookings WHERE run_id = ?', ['tc006-inflight']);
  });
});
