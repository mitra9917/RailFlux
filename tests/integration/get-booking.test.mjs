/**
 * TC-009: after commit, GET /v1/bookings/{id} returns the committed BookingResult
 * (client timeout / disconnect reconciliation).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { signSyntheticJwt } from '@railflux/shared';
import { createApp } from '../../services/baseline/dist/app.js';
import { createPool, pingDatabase } from '../../services/baseline/dist/db.js';
import { TC001_INVENTORY_3A_ID } from '../helpers/tc001-fixture.mjs';

const requireMysql = process.env.GET_BOOKING_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

describe('GET booking status (TC-009)', () => {
  let pool;
  let server;
  let port;
  let token;
  let mysqlAvailable = false;
  let fixtureUserId;

  before(async () => {
    const mysql = mysqlConfig();
    const config = {
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: 'get-booking-test-secret',
      mysql,
    };
    pool = createPool(config);
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireMysql) {
      throw new Error('GET_BOOKING_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
    fixtureUserId = userRows[0]?.id;
    if (!fixtureUserId) {
      throw new Error('fixture has no users; run npm run db:load');
    }

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
      t.skip('MySQL not available (run npm run test:get-booking with DB up)');
      return false;
    }
    return true;
  }

  async function getBooking(bookingId) {
    const res = await fetch(`http://127.0.0.1:${port}/v1/bookings/${bookingId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    return { status: res.status, body };
  }

  test('TC-009: GET returns committed CONFIRMED result after simulated POST timeout', async (t) => {
    if (!skipUnlessReady(t)) return;

    const bookingId = randomUUID();
    const expected = {
      bookingId,
      status: 'CONFIRMED',
      simulatedPnr: 'RF9876543210',
      errorCode: null,
    };

    await pool.query(
      `INSERT INTO bookings
         (id, run_id, user_id, inventory_id, status, seat_count, total_fare, simulated_pnr)
       VALUES (?, 'tc009-run', ?, ?, 'CONFIRMED', 1, 200.00, ?)`,
      [bookingId, fixtureUserId, TC001_INVENTORY_3A_ID, expected.simulatedPnr],
    );

    try {
      const { status, body } = await getBooking(bookingId);
      assert.equal(status, 200);
      assert.deepEqual(body, expected);
    } finally {
      await pool.query(`DELETE FROM bookings WHERE id = ?`, [bookingId]);
    }
  });

  test('GET returns in-progress PAYMENT_PENDING state', async (t) => {
    if (!skipUnlessReady(t)) return;

    const bookingId = randomUUID();
    await pool.query(
      `INSERT INTO bookings
         (id, run_id, user_id, inventory_id, status, seat_count, total_fare)
       VALUES (?, 'tc009-run', ?, ?, 'PAYMENT_PENDING', 1, 200.00)`,
      [bookingId, fixtureUserId, TC001_INVENTORY_3A_ID],
    );

    try {
      const { status, body } = await getBooking(bookingId);
      assert.equal(status, 200);
      assert.deepEqual(body, {
        bookingId,
        status: 'PAYMENT_PENDING',
        simulatedPnr: null,
        errorCode: null,
      });
    } finally {
      await pool.query(`DELETE FROM bookings WHERE id = ?`, [bookingId]);
    }
  });

  test('GET unknown booking returns 404 NOT_FOUND', async (t) => {
    if (!skipUnlessReady(t)) return;
    const { status, body } = await getBooking(randomUUID());
    assert.equal(status, 404);
    assert.equal(body.errorCode, 'NOT_FOUND');
  });

  test('GET invalid bookingId returns 400 VALIDATION_ERROR', async (t) => {
    if (!skipUnlessReady(t)) return;
    const res = await fetch(`http://127.0.0.1:${port}/v1/bookings/not-a-uuid`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.errorCode, 'VALIDATION_ERROR');
  });
});
