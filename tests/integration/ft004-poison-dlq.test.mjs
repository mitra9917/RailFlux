/**
 * FT-004: poison side-effect message redrives to DLQ without blocking unrelated messages.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, describe, test } from 'node:test';
import {
  buildBookingConfirmedOutboxMessage,
  SIDE_EFFECTS_MAX_RECEIVE_COUNT,
} from '@railflux/shared';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { createPool, pingDatabase } from '@railflux/baseline/db.js';
import { insertBookingConfirmedOutboxEvent } from '../../services/baseline/dist/services/booking-outbox.js';
import { receiveSideEffectsDlqMessage } from '@railflux/baseline/services/outbox-sqs-publisher.js';
import { pollSideEffectsQueueOnce } from '../../services/worker/dist/consume-side-effects.js';
import {
  createIntegrationSideEffectsSqsClient,
  prepareIntegrationSideEffectsQueue,
} from '../helpers/side-effects-sqs-test.mjs';

const requireIntegration = process.env.FT004_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

describe('FT-004 poison message DLQ (integration)', () => {
  let pool;
  let sqsClient;
  let queueUrl;
  let dlqUrl;
  let mysqlAvailable = false;
  let sqsAvailable = false;
  let fixtureUserId;

  before(async () => {
    pool = createPool({
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: 'ft004-test',
      mysql: mysqlConfig(),
    });
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireIntegration) {
      throw new Error('FT004_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    sqsClient = createIntegrationSideEffectsSqsClient();
    try {
      queueUrl = await prepareIntegrationSideEffectsQueue(sqsClient, {
        purge: false,
        visibilityTimeoutSeconds: 1,
      });
      dlqUrl = process.env.SQS_SIDE_EFFECTS_DLQ_URL;
      assert.ok(dlqUrl);
      sqsAvailable = true;
    } catch (err) {
      sqsAvailable = false;
      if (requireIntegration) {
        throw new Error(`FT004_INTEGRATION=1 but ElasticMQ unavailable: ${err}`);
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
      t.skip('MySQL/ElasticMQ not available (run npm run test:ft004-dlq)');
      return false;
    }
    return true;
  }

  async function seedOutboxEvent() {
    const bookingId = randomUUID();
    const eventId = randomUUID();
    const paymentId = randomUUID();
    const runId = 'ft004-integration';
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

  test('poison message reaches DLQ and good message still processes', async (t) => {
    if (!skipUnlessReady(t)) return;

    const seeded = await seedOutboxEvent();
    const poisonEventId = randomUUID();
    const poison = buildBookingConfirmedOutboxMessage({
      eventId: poisonEventId,
      bookingId: randomUUID(),
      runId: 'ft004-poison',
      userId: fixtureUserId,
      occurredAt: new Date(),
    });

    try {
      await prepareIntegrationSideEffectsQueue(sqsClient, {
        visibilityTimeoutSeconds: 1,
      });

      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(poison),
        }),
      );
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(seeded.message),
        }),
      );

      let goodProcessed = false;
      const maxPolls = 40;
      for (let i = 0; i < maxPolls; i += 1) {
        await pollSideEffectsQueueOnce(pool, sqsClient, queueUrl, 0);
        const [rows] = await pool.query(
          `SELECT 1 FROM processed_events WHERE event_id = ? LIMIT 1`,
          [seeded.eventId],
        );
        if (rows.length > 0) {
          goodProcessed = true;
          break;
        }
        await delay(150);
      }
      assert.equal(goodProcessed, true, 'expected good message to be processed');

      let dlqPoison = null;
      for (let i = 0; i < maxPolls; i += 1) {
        for (let attempt = 0; attempt < SIDE_EFFECTS_MAX_RECEIVE_COUNT; attempt += 1) {
          await pollSideEffectsQueueOnce(pool, sqsClient, queueUrl, 0);
          await delay(1100);
        }
        dlqPoison = await receiveSideEffectsDlqMessage(sqsClient, dlqUrl);
        if (dlqPoison?.eventId === poisonEventId) break;
        await delay(200);
      }

      assert.ok(dlqPoison, 'expected poison message on DLQ');
      assert.equal(dlqPoison.eventId, poisonEventId);

      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS c FROM processed_events WHERE event_id = ?`,
        [seeded.eventId],
      );
      assert.equal(Number(countRows[0].c), 1);
    } finally {
      await cleanup(seeded);
    }
  });
});
