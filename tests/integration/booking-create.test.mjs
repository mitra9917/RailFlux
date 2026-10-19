/**
 * M3 TC-003, TC-004 (HTTP), TC-008 (HTTP), TC-009 (POST commit + GET reconcile).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, afterEach, before, describe, test } from 'node:test';
import { signSyntheticJwt } from '@railflux/shared';
import { createApp } from '../../services/baseline/dist/app.js';
import { createPool, pingDatabase } from '../../services/baseline/dist/db.js';
import { resetPaymentStubRun } from '../../services/baseline/dist/services/payment-stub.js';
import { TC001_INVENTORY_3A_ID } from '../helpers/tc001-fixture.mjs';
import { mysqlConfig, postBooking, primePaymentStubForSuccess } from '../helpers/booking-http.mjs';

const requireMysql = process.env.BOOKING_CREATE_INTEGRATION === '1';

describe('POST /v1/bookings (M3 TC-003/004/008/009)', () => {
  let pool;
  let server;
  let port;
  let token;
  let baseUrl;
  let mysqlAvailable = false;
  let fixtureUserId;
  /** @type {import('@railflux/shared').CreateBookingRequest} */
  let createBody;
  const runId = 'm3-tc003-009';

  before(async () => {
    const mysql = mysqlConfig();
    const config = {
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: 'booking-create-test-secret',
      mysql,
    };
    pool = createPool(config);
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireMysql) {
      throw new Error('BOOKING_CREATE_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
    fixtureUserId = userRows[0]?.id;
    if (!fixtureUserId) throw new Error('fixture has no users');

    createBody = {
      userId: fixtureUserId,
      inventoryId: TC001_INVENTORY_3A_ID,
      passengers: [{ syntheticName: 'Synthetic Pax', age: 30 }],
      paymentToken: 'stub-payment-token',
    };

    token = await signSyntheticJwt(config.syntheticJwtSecret, { userId: fixtureUserId });
    const app = createApp(config, pool);
    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
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
      t.skip('MySQL not available (run npm run test:booking-create)');
      return false;
    }
    return true;
  }

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

  test('TC-003: booking success claim, payment, outbox, and response', async (t) => {
    if (!skipUnlessReady(t)) return;
    await primePaymentStubForSuccess();
    const idempotencyKey = `tc003-${randomUUID()}`;

    const res = await postBooking(baseUrl, token, idempotencyKey, createBody, runId);
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'CONFIRMED');
    assert.match(res.body.simulatedPnr, /^RF[0-9]{10}$/);
    assert.equal(res.body.errorCode, null);

    const [outbox] = await pool.query(
      `SELECT COUNT(*) AS c FROM outbox_events WHERE aggregate_id = ? AND event_type = 'BOOKING_CONFIRMED'`,
      [res.body.bookingId],
    );
    assert.equal(Number(outbox[0].c), 1);

    const [payments] = await pool.query(
      `SELECT status FROM payments WHERE booking_id = ?`,
      [res.body.bookingId],
    );
    assert.equal(payments[0]?.status, 'SUCCESS');
  });

  test('TC-004: POST returns 409 SOLD_OUT without negative inventory', async (t) => {
    if (!skipUnlessReady(t)) return;
    resetPaymentStubRun();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE seat_inventory SET available_seats = 0 WHERE id = ?`,
        [TC001_INVENTORY_3A_ID],
      );
      await conn.commit();
    } finally {
      conn.release();
    }

    const idempotencyKey = `tc004-${randomUUID()}`;
    const res = await postBooking(baseUrl, token, idempotencyKey, createBody, runId);
    assert.equal(res.status, 409);
    assert.equal(res.body.errorCode, 'SOLD_OUT');

    const [inv] = await pool.query(
      `SELECT available_seats AS availableSeats FROM seat_inventory WHERE id = ?`,
      [TC001_INVENTORY_3A_ID],
    );
    assert.equal(inv[0].availableSeats, 0);

    const replay = await postBooking(baseUrl, token, idempotencyKey, createBody, runId);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.status, 'SOLD_OUT');
  });

  test('TC-008: POST payment failure releases inventory (422)', async (t) => {
    if (!skipUnlessReady(t)) return;
    resetPaymentStubRun();

    const [beforeRows] = await pool.query(
      `SELECT available_seats AS availableSeats, version FROM seat_inventory WHERE id = ?`,
      [TC001_INVENTORY_3A_ID],
    );
    const before = beforeRows[0];

    const idempotencyKey = `tc008-http-${randomUUID()}`;
    const res = await postBooking(baseUrl, token, idempotencyKey, createBody, runId);
    assert.equal(res.status, 422);
    assert.equal(res.body.status, 'FAILED');
    assert.equal(res.body.errorCode, 'PAYMENT_FAILED');

    const [afterRows] = await pool.query(
      `SELECT available_seats AS availableSeats FROM seat_inventory WHERE id = ?`,
      [TC001_INVENTORY_3A_ID],
    );
    assert.equal(afterRows[0].availableSeats, before.availableSeats);
  });

  test('TC-009: GET reconciles committed booking after POST', async (t) => {
    if (!skipUnlessReady(t)) return;
    await primePaymentStubForSuccess();
    const idempotencyKey = `tc009-${randomUUID()}`;
    const post = await postBooking(baseUrl, token, idempotencyKey, createBody, runId);
    assert.equal(post.status, 201);

    const getRes = await fetch(`${baseUrl}/v1/bookings/${post.body.bookingId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const getBody = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.deepEqual(getBody, post.body);
  });
});
