/**
 * TC-007: parallel POST /v1/bookings for one remaining seat → exactly one CONFIRMED.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { signSyntheticJwt } from '@railflux/shared';
import { createApp } from '../../services/baseline/dist/app.js';
import { createPool, pingDatabase } from '../../services/baseline/dist/db.js';
import { resetPaymentStubRun } from '../../services/baseline/dist/services/payment-stub.js';
import {
  resolveFixtureId,
  runCorrectnessChecks,
} from '../../database/scripts/correctness-runner.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mysqlConfig, postBooking } from '../helpers/booking-http.mjs';

const requireMysql = process.env.TC007_INTEGRATION === '1';
const CONCURRENCY = Number(process.env.TC007_CONCURRENCY ?? '32');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = path.join(repoRoot, 'experiment/fixtures/manifest.yaml');

describe('TC-007 concurrent last seat', () => {
  let pool;
  let server;
  let port;
  let baseUrl;
  let token;
  let mysqlAvailable = false;
  let fixtureUserId;
  let fixtureId;
  let inventoryId;
  let inventorySnapshot;

  before(async () => {
    process.env.PAYMENT_STUB_FORCE_SUCCESS = '1';
    const mysql = mysqlConfig();
    const config = {
      nodeEnv: 'test',
      port: 0,
      profile: 'baseline',
      syntheticJwtSecret: 'tc007-contention-secret',
      mysql,
    };
    pool = createPool(config);
    mysqlAvailable = await pingDatabase(pool);
    if (!mysqlAvailable && requireMysql) {
      throw new Error('TC007_INTEGRATION=1 but MySQL is unavailable');
    }
    if (!mysqlAvailable) return;

    fixtureId = resolveFixtureId(manifestPath);
    const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
    fixtureUserId = userRows[0]?.id;
    assert.ok(fixtureUserId, 'fixture users required');

    const [invRows] = await pool.query(
      `SELECT id, initial_seats AS initialSeats, available_seats AS availableSeats, version
       FROM seat_inventory WHERE fixture_id = ? LIMIT 1`,
      [fixtureId],
    );
    inventoryId = invRows[0]?.id;
    inventorySnapshot = invRows[0];
    assert.ok(inventoryId, 'fixture inventory required');

    token = await signSyntheticJwt(config.syntheticJwtSecret, { userId: fixtureUserId });
    const app = createApp(config, pool);
    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    resetPaymentStubRun();
  });

  after(async () => {
    delete process.env.PAYMENT_STUB_FORCE_SUCCESS;
    if (inventoryId && inventorySnapshot) {
      await pool?.query(
        `UPDATE seat_inventory
         SET initial_seats = ?, available_seats = ?, version = ?
         WHERE id = ?`,
        [
          inventorySnapshot.initialSeats,
          inventorySnapshot.availableSeats,
          inventorySnapshot.version,
          inventoryId,
        ],
      );
    }
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (pool) await pool.end();
  });

  function skipUnlessReady(t) {
    if (!mysqlAvailable) {
      t.skip('MySQL not available (run npm run test:tc007-contention)');
      return false;
    }
    return true;
  }

  test('exactly one confirmation under parallel contenders', async (t) => {
    if (!skipUnlessReady(t)) return;

    const runId = `tc007-${randomUUID()}`;
    await pool.query(
      `UPDATE seat_inventory SET available_seats = initial_seats WHERE fixture_id = ?`,
      [fixtureId],
    );
    await pool.query(
      `UPDATE seat_inventory SET initial_seats = 1, available_seats = 1, version = 0 WHERE id = ?`,
      [inventoryId],
    );

    const createBody = {
      userId: fixtureUserId,
      inventoryId,
      passengers: [{ syntheticName: 'Contender', age: 25 }],
      paymentToken: 'stub-payment-token',
    };

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        postBooking(baseUrl, token, `tc007-key-${runId}-${i}`, createBody, runId),
      ),
    );

    const confirmed = results.filter((r) => r.status === 201 && r.body.status === 'CONFIRMED');
    const soldOut = results.filter((r) => r.status === 409 && r.body.errorCode === 'SOLD_OUT');

    assert.equal(confirmed.length, 1, `expected 1 CONFIRMED, got ${confirmed.length}`);
    const failures = results.filter((r) => r.status !== 201 && r.status !== 409);
    assert.deepEqual(failures, [], `unexpected responses: ${JSON.stringify(failures)}`);
    assert.equal(soldOut.length, CONCURRENCY - 1, 'remaining contenders should be sold out');

    const [inv] = await pool.query(
      `SELECT available_seats AS availableSeats FROM seat_inventory WHERE id = ?`,
      [inventoryId],
    );
    assert.equal(inv[0].availableSeats, 0);

    const [confirmedRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM bookings WHERE run_id = ? AND status = 'CONFIRMED'`,
      [runId],
    );
    assert.equal(Number(confirmedRows[0].c), 1);

    const reconciliation = await runCorrectnessChecks(pool, { runId, fixtureId });
    assert.equal(reconciliation.passed, true, JSON.stringify(reconciliation.failures));

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
    await pool.query(
      `UPDATE seat_inventory SET initial_seats = ?, available_seats = ?, version = ? WHERE id = ?`,
      [
        inventorySnapshot.initialSeats,
        inventorySnapshot.availableSeats,
        inventorySnapshot.version,
        inventoryId,
      ],
    );
  });
});
