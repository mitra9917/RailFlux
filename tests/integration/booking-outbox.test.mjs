/**
 * M3 #25: confirmed booking is durable with outbox row; baseline sync handler dedupes.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import {
  BASELINE_BOOKING_CONFIRMED_HANDLER,
  BOOKING_CONFIRMED_EVENT_TYPE,
} from '@railflux/shared';
import {
  insertBookingConfirmedOutboxEvent,
  processBookingConfirmedOutboxSynchronously,
} from '../../services/baseline/dist/services/booking-outbox.js';
import { createPool, pingDatabase } from '../../services/baseline/dist/db.js';

const requireMysql = process.env.OUTBOX_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

describe('baseline booking outbox (M3 #25)', () => {
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
      throw new Error('OUTBOX_INTEGRATION=1 but MySQL is unavailable');
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
      t.skip('MySQL not available (run npm run test:booking-outbox with DB up)');
      return false;
    }
    return true;
  }

  test('confirmed booking commit leaves durable outbox and sync handler runs once', async (t) => {
    if (!skipUnlessReady(t)) return;

    const bookingId = randomUUID();
    const eventId = randomUUID();
    const paymentId = randomUUID();
    const runId = 'outbox-integration';
    const inventoryId = (
      await pool.query(
        `SELECT id FROM seat_inventory WHERE available_seats > 0 LIMIT 1`,
      )
    )[0][0]?.id;
    assert.ok(inventoryId, 'need inventory row');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO bookings (id, run_id, user_id, inventory_id, status, seat_count, total_fare, simulated_pnr)
         VALUES (?, ?, ?, ?, 'CONFIRMED', 1, 150.00, 'RF1234567890')`,
        [bookingId, runId, fixtureUserId, inventoryId],
      );
      await conn.query(
        `INSERT INTO payments (id, run_id, booking_id, status, stub_sequence)
         VALUES (?, ?, ?, 'SUCCESS', '481516:1')`,
        [paymentId, runId, bookingId],
      );

      const message = await insertBookingConfirmedOutboxEvent(conn, {
        eventId,
        bookingId,
        runId,
        userId: fixtureUserId,
      });
      assert.equal(message.bookingId, bookingId);

      await conn.commit();

      const processConn = await pool.getConnection();
      try {
        await processConn.beginTransaction();
        const first = await processBookingConfirmedOutboxSynchronously(processConn, {
          eventId,
          runId,
        });
        assert.deepEqual(first, {
          ok: true,
          processed: true,
          handlerType: BASELINE_BOOKING_CONFIRMED_HANDLER,
        });
        await processConn.commit();
      } finally {
        processConn.release();
      }

      const [outboxRows] = await pool.query(
        `SELECT event_type AS eventType, published_at AS publishedAt
         FROM outbox_events WHERE event_id = ?`,
        [eventId],
      );
      assert.equal(outboxRows[0].eventType, BOOKING_CONFIRMED_EVENT_TYPE);
      assert.ok(outboxRows[0].publishedAt, 'published_at set after sync handler');

      const [processedRows] = await pool.query(
        `SELECT handler_type AS handlerType FROM processed_events WHERE event_id = ?`,
        [eventId],
      );
      assert.equal(processedRows.length, 1);
      assert.equal(processedRows[0].handlerType, BASELINE_BOOKING_CONFIRMED_HANDLER);

      const [reconcile] = await pool.query(
        `SELECT b.id
         FROM bookings b
         LEFT JOIN outbox_events o
           ON o.aggregate_id = b.id AND o.event_type = 'BOOKING_CONFIRMED'
         WHERE b.run_id = ? AND b.id = ? AND b.status = 'CONFIRMED'
         GROUP BY b.id
         HAVING COUNT(o.event_id) = 1`,
        [runId, bookingId],
      );
      assert.equal(reconcile.length, 1);

      const processConn2 = await pool.getConnection();
      try {
        await processConn2.beginTransaction();
        const second = await processBookingConfirmedOutboxSynchronously(processConn2, {
          eventId,
          runId,
        });
        assert.equal(second.ok, true);
        assert.equal(second.processed, false);
        assert.equal(second.reason, 'ALREADY_PROCESSED');
        await processConn2.commit();
      } finally {
        processConn2.release();
      }

      const [processedAfter] = await pool.query(
        `SELECT COUNT(*) AS c FROM processed_events WHERE event_id = ?`,
        [eventId],
      );
      assert.equal(Number(processedAfter[0].c), 1);

      await pool.query(`DELETE FROM processed_events WHERE event_id = ?`, [eventId]);
      await pool.query(`DELETE FROM outbox_events WHERE event_id = ?`, [eventId]);
      await pool.query(`DELETE FROM payments WHERE id = ?`, [paymentId]);
      await pool.query(`DELETE FROM bookings WHERE id = ?`, [bookingId]);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });
});
