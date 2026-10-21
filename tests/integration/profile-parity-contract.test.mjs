/**
 * M4 #39: baseline monolith vs optimized edge stack — same API contract outcomes.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, describe, test } from 'node:test';
import { signSyntheticJwt } from '@railflux/shared';
import { createPool, pingDatabase } from '@railflux/baseline/db.js';
import { resetPaymentStubRun } from '../../services/baseline/dist/services/payment-stub.js';
import { mysqlConfig, postBooking, primePaymentStubForSuccess } from '../helpers/booking-http.mjs';
import {
  createBaselineAndOptimizedStacks,
  jsonFetch,
} from '../helpers/parity-http-stack.mjs';
import {
  normalizeAvailabilityBody,
  normalizeBookingCreateOutcome,
  normalizeErrorBody,
  normalizeGetBookingBody,
  normalizeSearchBody,
} from '../helpers/parity-normalize.mjs';
import {
  TC001_FROM,
  TC001_JOURNEY_DATE,
  TC001_TO,
  TC001_TRAIN_RUN_ID,
  TC001_TRAIN_NO,
  TC001_INVENTORY_3A_ID,
} from '../helpers/tc001-fixture.mjs';

const requireIntegration = process.env.PROFILE_PARITY_INTEGRATION === '1';
const secret = 'profile-parity-test-secret';

describe('baseline vs optimized API parity (integration)', () => {
  let pool;
  let stacks;
  let baselineOrigin;
  let optimizedOrigin;
  let token;
  let fixtureUserId;
  let mysqlAvailable = false;
  const prevOutboxDelivery = process.env.OUTBOX_DELIVERY;

  before(async () => {
    process.env.OUTBOX_DELIVERY = 'sync';
    const mysql = mysqlConfig();
    pool = createPool({
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: secret,
      mysql,
    });
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireIntegration) {
      throw new Error('PROFILE_PARITY_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
    fixtureUserId = userRows[0]?.id;
    if (!fixtureUserId) throw new Error('fixture has no users');

    token = await signSyntheticJwt(secret, { userId: fixtureUserId });
    stacks = await createBaselineAndOptimizedStacks(pool, mysql, secret);
    baselineOrigin = stacks.baselineOrigin;
    optimizedOrigin = stacks.optimizedOrigin;
  });

  after(async () => {
    if (prevOutboxDelivery === undefined) {
      delete process.env.OUTBOX_DELIVERY;
    } else {
      process.env.OUTBOX_DELIVERY = prevOutboxDelivery;
    }
    if (stacks) await stacks.close();
    if (pool) await pool.end();
  });

  function skipUnlessReady(t) {
    if (!mysqlAvailable) {
      t.skip('MySQL not available (run npm run test:profile-parity)');
      return false;
    }
    return true;
  }

  const runId = 'profile-parity';

  async function cleanupRunBookings(run) {
    const [bookingRows] = await pool.query(`SELECT id FROM bookings WHERE run_id = ?`, [run]);
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
    await pool.query(`DELETE FROM booking_idempotency WHERE run_id = ?`, [run]);
    await pool.query(`DELETE FROM bookings WHERE run_id = ?`, [run]);
  }

  afterEach(async () => {
    if (!mysqlAvailable) return;
    await pool.query(
      `UPDATE seat_inventory SET available_seats = initial_seats WHERE id = ?`,
      [TC001_INVENTORY_3A_ID],
    );
    await cleanupRunBookings(runId);
    resetPaymentStubRun();
  });

  test('search and availability match (modulo cache freshness timing)', async (t) => {
    if (!skipUnlessReady(t)) return;

    const searchPath = `/v1/search?from=${TC001_FROM}&to=${TC001_TO}&date=${TC001_JOURNEY_DATE}`;
    const baseSearch = await jsonFetch(baselineOrigin, searchPath, { token });
    const optSearch = await jsonFetch(optimizedOrigin, searchPath, { token });
    assert.equal(baseSearch.status, optSearch.status);
    assert.deepEqual(normalizeSearchBody(baseSearch.body), normalizeSearchBody(optSearch.body));
    assert.ok(
      baseSearch.body.items.some((item) => item.trainNo === TC001_TRAIN_NO),
      'baseline search includes fixture train',
    );

    const availPath = `/v1/availability?trainRunId=${TC001_TRAIN_RUN_ID}&class=3A&quota=TATKAL`;
    const baseAvail = await jsonFetch(baselineOrigin, availPath, { token });
    const optAvail = await jsonFetch(optimizedOrigin, availPath, { token });
    assert.equal(baseAvail.status, optAvail.status);
    assert.deepEqual(
      normalizeAvailabilityBody(baseAvail.body),
      normalizeAvailabilityBody(optAvail.body),
    );
  });

  test('validation errors match', async (t) => {
    if (!skipUnlessReady(t)) return;

    const badSearch = `/v1/search?from=bad&to=${TC001_TO}&date=${TC001_JOURNEY_DATE}`;
    const base = await jsonFetch(baselineOrigin, badSearch, { token });
    const opt = await jsonFetch(optimizedOrigin, badSearch, { token });
    assert.equal(base.status, opt.status);
    assert.equal(base.status, 400);
    assert.deepEqual(normalizeErrorBody(base.body), normalizeErrorBody(opt.body));
  });

  test('booking create and GET outcomes match', async (t) => {
    if (!skipUnlessReady(t)) return;

    await primePaymentStubForSuccess();
    const createBody = {
      userId: fixtureUserId,
      inventoryId: TC001_INVENTORY_3A_ID,
      passengers: [{ syntheticName: 'Parity Pax', age: 30 }],
      paymentToken: 'stub-payment-token',
    };

    const baseCreate = await postBooking(
      baselineOrigin,
      token,
      randomUUID(),
      createBody,
      runId,
    );
    assert.equal(baseCreate.status, 201);
    const baseGet = await jsonFetch(baselineOrigin, `/v1/bookings/${baseCreate.body.bookingId}`, {
      token,
    });
    assert.equal(baseGet.status, 200);

    await pool.query(
      `UPDATE seat_inventory SET available_seats = initial_seats WHERE id = ?`,
      [TC001_INVENTORY_3A_ID],
    );
    await cleanupRunBookings(runId);
    resetPaymentStubRun();
    await primePaymentStubForSuccess();

    const optCreate = await postBooking(
      optimizedOrigin,
      token,
      randomUUID(),
      createBody,
      runId,
    );
    assert.equal(optCreate.status, 201);
    const optGet = await jsonFetch(optimizedOrigin, `/v1/bookings/${optCreate.body.bookingId}`, {
      token,
    });
    assert.equal(optGet.status, 200);

    assert.deepEqual(
      normalizeBookingCreateOutcome(baseCreate),
      normalizeBookingCreateOutcome(optCreate),
    );
    assert.deepEqual(normalizeGetBookingBody(baseGet.body), normalizeGetBookingBody(optGet.body));
    assert.match(baseGet.body.simulatedPnr ?? '', /^RF\d{10}$/);
    assert.match(optGet.body.simulatedPnr ?? '', /^RF\d{10}$/);
  });
});
