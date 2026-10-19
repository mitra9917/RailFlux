/**
 * M4 #35: BOOKING_CONFIRMED outbox row is published to SQS/ElasticMQ after commit.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, afterEach, before, describe, test } from 'node:test';
import { SIDE_EFFECTS_QUEUE_NAME } from '@railflux/shared';
import { createBookingApp } from '../../services/booking/dist/app.js';
import { createPool, pingDatabase } from '@railflux/baseline/db.js';
import {
  createSideEffectsSqsClient,
  ensureSideEffectsQueue,
  receiveSideEffectsMessage,
} from '@railflux/baseline/services/outbox-sqs-publisher.js';
import { resetPaymentStubRun } from '../../services/baseline/dist/services/payment-stub.js';
import { TC001_INVENTORY_3A_ID } from '../helpers/tc001-fixture.mjs';
import { mysqlConfig, postBooking, primePaymentStubForSuccess } from '../helpers/booking-http.mjs';

const requireIntegration = process.env.OUTBOX_SQS_INTEGRATION === '1';

function sqsEndpoint() {
  return process.env.SQS_ENDPOINT ?? 'http://127.0.0.1:9324';
}

describe('outbox SQS publish (M4 #35)', () => {
  let pool;
  let server;
  let port;
  let baseUrl;
  let token;
  let fixtureUserId;
  let queueUrl;
  let sqsClient;
  let mysqlAvailable = false;
  let sqsAvailable = false;
  const runId = 'outbox-sqs-integration';
  const secret = 'outbox-sqs-test-secret';

  before(async () => {
    process.env.OUTBOX_DELIVERY = 'sqs';
    process.env.SQS_ENDPOINT = sqsEndpoint();
    process.env.AWS_REGION = 'elasticmq-local';

    const mysql = mysqlConfig();
    const bookingConfig = {
      nodeEnv: 'test',
      port: 0,
      profile: 'optimized',
      syntheticJwtSecret: secret,
      mysql,
    };

    pool = createPool({
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: secret,
      mysql,
    });
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireIntegration) {
      throw new Error('OUTBOX_SQS_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    sqsClient = createSideEffectsSqsClient({
      region: 'elasticmq-local',
      endpoint: sqsEndpoint(),
      queueUrl: 'http://placeholder',
    });
    try {
      queueUrl = await ensureSideEffectsQueue(sqsClient, SIDE_EFFECTS_QUEUE_NAME);
      process.env.SQS_SIDE_EFFECTS_QUEUE_URL = queueUrl;
      sqsAvailable = true;
    } catch (err) {
      sqsAvailable = false;
      if (requireIntegration) {
        throw new Error(
          `OUTBOX_SQS_INTEGRATION=1 but ElasticMQ is unavailable at ${sqsEndpoint()}: ${err}`,
        );
      }
      return;
    }

    const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
    fixtureUserId = userRows[0]?.id;
    if (!fixtureUserId) throw new Error('fixture has no users');

    const { signSyntheticJwt } = await import('@railflux/shared');
    token = await signSyntheticJwt(secret, { userId: fixtureUserId });

    const app = createBookingApp(bookingConfig, pool);
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
    delete process.env.OUTBOX_DELIVERY;
  });

  afterEach(async () => {
    if (!mysqlAvailable) return;
    await pool.query(
      `UPDATE seat_inventory SET available_seats = initial_seats WHERE id = ?`,
      [TC001_INVENTORY_3A_ID],
    );
    const [bookingRows] = await pool.query(`SELECT id FROM bookings WHERE run_id = ?`, [runId]);
    for (const row of bookingRows) {
      await pool.query(`DELETE FROM outbox_events WHERE aggregate_id = ?`, [row.id]);
      await pool.query(`DELETE FROM payments WHERE booking_id = ?`, [row.id]);
      await pool.query(`DELETE FROM booking_passengers WHERE booking_id = ?`, [row.id]);
    }
    await pool.query(`DELETE FROM booking_idempotency WHERE run_id = ?`, [runId]);
    await pool.query(`DELETE FROM bookings WHERE run_id = ?`, [runId]);
    resetPaymentStubRun();
  });

  function skipUnlessReady(t) {
    if (!mysqlAvailable || !sqsAvailable) {
      t.skip('MySQL/ElasticMQ not available (run npm run test:outbox-sqs)');
      return false;
    }
    return true;
  }

  test('confirmed booking publishes BOOKING_CONFIRMED message to side-effects queue', async (t) => {
    if (!skipUnlessReady(t)) return;

    await primePaymentStubForSuccess();
    const idempotencyKey = randomUUID();
    const body = {
      userId: fixtureUserId,
      inventoryId: TC001_INVENTORY_3A_ID,
      passengers: [{ syntheticName: 'SQS Pax', age: 30 }],
      paymentToken: 'stub-payment-token',
    };

    const created = await postBooking(baseUrl, token, idempotencyKey, body, runId);
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'CONFIRMED');

    const [outboxRows] = await pool.query(
      `SELECT published_at AS publishedAt FROM outbox_events WHERE aggregate_id = ?`,
      [created.body.bookingId],
    );
    assert.equal(outboxRows.length, 1);
    assert.ok(outboxRows[0].publishedAt, 'published_at set after SQS send');

    let message = null;
    for (let attempt = 0; attempt < 5 && !message; attempt += 1) {
      message = await receiveSideEffectsMessage(sqsClient, queueUrl);
    }
    assert.ok(message, 'expected SQS message for confirmed booking');
    assert.equal(message.eventType, 'BOOKING_CONFIRMED');
    assert.equal(message.bookingId, created.body.bookingId);
    assert.equal(message.runId, runId);
  });
});
