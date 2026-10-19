/**
 * TC-008: failed payment releases inventory exactly once; no confirmed booking remains.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import {
  DEFAULT_PAYMENT_STUB_CONFIG,
  derivePaymentStubOutcome,
} from '@railflux/shared';
import { claimInventorySeats } from '../../services/baseline/dist/services/claim-inventory.js';
import { finalizeBookingAfterPaymentFailure } from '../../services/baseline/dist/services/payment-failure-release.js';
import { createPool, pingDatabase } from '../../services/baseline/dist/db.js';
import { TC001_INVENTORY_3A_ID } from '../helpers/tc001-fixture.mjs';

const requireMysql = process.env.PAYMENT_FAILURE_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

async function readInventory(conn, inventoryId) {
  const [rows] = await conn.query(
    `SELECT available_seats AS availableSeats, version
     FROM seat_inventory WHERE id = ?`,
    [inventoryId],
  );
  return rows[0];
}

describe('payment failure inventory release (TC-008)', () => {
  /** @type {import('../../services/baseline/dist/db.js').DbPool | undefined} */
  let pool;
  let mysqlAvailable = false;
  let fixtureUserId;

  before(async () => {
    pool = createPool({
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: 'test',
      mysql: mysqlConfig(),
    });
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireMysql) {
      throw new Error('PAYMENT_FAILURE_INTEGRATION=1 but MySQL is unavailable');
    }
    if (mysqlAvailable) {
      const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
      fixtureUserId = userRows[0]?.id;
      if (!fixtureUserId) {
        throw new Error('fixture has no users; run npm run db:load');
      }
    }
  });

  after(async () => {
    if (pool) await pool.end();
  });

  function skipUnlessReady(t) {
    if (!mysqlAvailable) {
      t.skip('MySQL not available (run npm run test:payment-failure with DB up)');
      return false;
    }
    return true;
  }

  test('TC-008: payment failure restores inventory and is idempotent', async (t) => {
    if (!skipUnlessReady(t)) return;

    const paymentOutcome = derivePaymentStubOutcome(DEFAULT_PAYMENT_STUB_CONFIG, 0);
    assert.equal(paymentOutcome.success, false, 'attempt 0 must fail for default manifest');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const before = await readInventory(conn, TC001_INVENTORY_3A_ID);
      assert.ok(before, 'fixture inventory row missing');

      const claim = await claimInventorySeats(conn, {
        inventoryId: TC001_INVENTORY_3A_ID,
        seatCount: 1,
        expectedVersion: before.version,
      });
      assert.equal(claim.ok, true);

      const bookingId = randomUUID();
      const paymentId = randomUUID();
      const runId = 'tc008-integration';
      await conn.query(
        `INSERT INTO bookings (id, run_id, user_id, inventory_id, status, seat_count, total_fare)
         VALUES (?, ?, ?, ?, 'PAYMENT_PENDING', 1, 100.00)`,
        [bookingId, runId, fixtureUserId, TC001_INVENTORY_3A_ID],
      );
      await conn.query(
        `INSERT INTO payments (id, run_id, booking_id, status, stub_sequence)
         VALUES (?, ?, ?, 'PENDING', ?)`,
        [paymentId, runId, bookingId, paymentOutcome.stubSequence],
      );

      const first = await finalizeBookingAfterPaymentFailure(conn, {
        bookingId,
        inventoryId: TC001_INVENTORY_3A_ID,
        seatCount: 1,
        inventoryVersionAfterClaim: claim.version,
        paymentId,
      });
      assert.deepEqual(first, {
        ok: true,
        released: true,
        bookingStatus: 'FAILED',
        availableSeats: before.availableSeats,
        inventoryVersion: claim.version + 1,
      });

      const [bookingRows] = await conn.query(
        `SELECT status FROM bookings WHERE id = ?`,
        [bookingId],
      );
      assert.equal(bookingRows[0].status, 'FAILED');
      const [paymentRows] = await conn.query(
        `SELECT status FROM payments WHERE id = ?`,
        [paymentId],
      );
      assert.equal(paymentRows[0].status, 'FAILED');

      const afterRelease = await readInventory(conn, TC001_INVENTORY_3A_ID);
      assert.equal(afterRelease.availableSeats, before.availableSeats);
      assert.equal(afterRelease.version, claim.version + 1);

      const second = await finalizeBookingAfterPaymentFailure(conn, {
        bookingId,
        inventoryId: TC001_INVENTORY_3A_ID,
        seatCount: 1,
        inventoryVersionAfterClaim: claim.version,
        paymentId,
      });
      assert.equal(second.ok, true);
      assert.equal(second.released, false);

      const afterIdempotent = await readInventory(conn, TC001_INVENTORY_3A_ID);
      assert.equal(afterIdempotent.availableSeats, before.availableSeats);
      assert.equal(afterIdempotent.version, claim.version + 1);

      const [confirmed] = await conn.query(
        `SELECT COUNT(*) AS c FROM bookings WHERE id = ? AND status = 'CONFIRMED'`,
        [bookingId],
      );
      assert.equal(Number(confirmed[0].c), 0);

      await conn.rollback();
    } finally {
      conn.release();
    }
  });
});
