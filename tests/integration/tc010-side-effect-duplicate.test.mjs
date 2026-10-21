/**
 * TC-010: repeated SQS delivery performs side-effect handler once (processed_events dedupe).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import {
  BASELINE_BOOKING_CONFIRMED_HANDLER,
  BOOKING_CONFIRMED_EVENT_TYPE,
  SIDE_EFFECTS_QUEUE_NAME,
} from '@railflux/shared';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { createPool, pingDatabase } from '@railflux/baseline/db.js';
import {
  insertBookingConfirmedOutboxEvent,
} from '../../services/baseline/dist/services/booking-outbox.js';
import { processBookingConfirmedSideEffectMessage } from '@railflux/baseline/services/booking-side-effect-worker.js';
import {
  createSideEffectsSqsClient,
  ensureSideEffectsQueue,
} from '@railflux/baseline/services/outbox-sqs-publisher.js';
import { pollSideEffectsQueueOnce } from '../../services/worker/dist/consume-side-effects.js';

const requireIntegration = process.env.TC010_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

function sqsEndpoint() {
  return process.env.SQS_ENDPOINT ?? 'http://127.0.0.1:9324';
}

describe('TC-010 side-effect duplicate (integration)', () => {
  let pool;
  let sqsClient;
  let queueUrl;
  let mysqlAvailable = false;
  let sqsAvailable = false;
  let fixtureUserId;

  before(async () => {
    pool = createPool({
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: 'tc010-test',
      mysql: mysqlConfig(),
    });
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireIntegration) {
      throw new Error('TC010_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    sqsClient = createSideEffectsSqsClient({
      region: 'elasticmq-local',
      endpoint: sqsEndpoint(),
      queueUrl: 'http://placeholder',
    });
    try {
      queueUrl = await ensureSideEffectsQueue(sqsClient, SIDE_EFFECTS_QUEUE_NAME);
      sqsAvailable = true;
    } catch (err) {
      sqsAvailable = false;
      if (requireIntegration) {
        throw new Error(`TC010_INTEGRATION=1 but ElasticMQ unavailable: ${err}`);
      }
    }

    const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
    fixtureUserId = userRows[0]?.id;
    if (!fixtureUserId) throw new Error('fixture has no users');
  });

  after(async () => {
    if (pool) await pool.end();
  });

  function skipUnlessReady(t) {
    if (!mysqlAvailable || !sqsAvailable) {
      t.skip('MySQL/ElasticMQ not available (run npm run test:tc010)');
      return false;
    }
    return true;
  }

  async function seedOutboxEvent() {
    const bookingId = randomUUID();
    const eventId = randomUUID();
    const paymentId = randomUUID();
    const runId = 'tc010-integration';
    const inventoryId = (
      await pool.query(`SELECT id FROM seat_inventory WHERE available_seats > 0 LIMIT 1`)
    )[0][0]?.id;
    assert.ok(inventoryId);

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
      await conn.commit();
      return { bookingId, eventId, paymentId, runId, message };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async function cleanup({ bookingId, eventId, paymentId }) {
    await pool.query(`DELETE FROM processed_events WHERE event_id = ?`, [eventId]);
    await pool.query(`DELETE FROM outbox_events WHERE event_id = ?`, [eventId]);
    await pool.query(`DELETE FROM payments WHERE id = ?`, [paymentId]);
    await pool.query(`DELETE FROM bookings WHERE id = ?`, [bookingId]);
  }

  test('duplicate handler invocation records processed_events once', async (t) => {
    if (!skipUnlessReady(t)) return;

    const seeded = await seedOutboxEvent();
    try {
      const first = await processBookingConfirmedSideEffectMessage(pool, seeded.message);
      assert.equal(first.ok, true);
      assert.equal(first.processed, true);

      const second = await processBookingConfirmedSideEffectMessage(pool, seeded.message);
      assert.equal(second.ok, true);
      assert.equal(second.processed, false);
      assert.equal(second.reason, 'ALREADY_PROCESSED');

      const [rows] = await pool.query(
        `SELECT COUNT(*) AS c FROM processed_events WHERE event_id = ? AND handler_type = ?`,
        [seeded.eventId, BASELINE_BOOKING_CONFIRMED_HANDLER],
      );
      assert.equal(Number(rows[0].c), 1);
    } finally {
      await cleanup(seeded);
    }
  });

  test('duplicate SQS deliveries are deduped by worker polls', async (t) => {
    if (!skipUnlessReady(t)) return;

    const seeded = await seedOutboxEvent();
    const body = JSON.stringify(seeded.message);
    try {
      await sqsClient.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: body }));
      await sqsClient.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: body }));

      const poll1 = await pollSideEffectsQueueOnce(pool, sqsClient, queueUrl, 2);
      assert.equal(poll1.received, 1);
      assert.equal(poll1.processed, 1);

      const poll2 = await pollSideEffectsQueueOnce(pool, sqsClient, queueUrl, 2);
      assert.equal(poll2.received, 1);
      assert.equal(poll2.duplicates, 1);

      const [rows] = await pool.query(
        `SELECT COUNT(*) AS c FROM processed_events WHERE event_id = ?`,
        [seeded.eventId],
      );
      assert.equal(Number(rows[0].c), 1);

      const [outbox] = await pool.query(
        `SELECT event_type AS eventType FROM outbox_events WHERE event_id = ?`,
        [seeded.eventId],
      );
      assert.equal(outbox[0].eventType, BOOKING_CONFIRMED_EVENT_TYPE);
    } finally {
      await cleanup(seeded);
    }
  });
});
