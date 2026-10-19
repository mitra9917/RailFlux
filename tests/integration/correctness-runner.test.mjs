/**
 * M3 #27: post-run correctness SQL runner bindings and failure semantics.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';
import {
  resolveFixtureId,
  runCorrectnessChecks,
} from '../../database/scripts/correctness-runner.mjs';
import { createPool, pingDatabase } from '../../services/baseline/dist/db.js';

const requireMysql = process.env.CORRECTNESS_INTEGRATION === '1';

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = path.join(repoRoot, 'experiment/fixtures/manifest.yaml');

describe('correctness SQL runner (M3 #27)', () => {
  /** @type {import('../../services/baseline/dist/db.js').DbPool | undefined} */
  let pool;
  let mysqlAvailable = false;
  let fixtureId;

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
      throw new Error('CORRECTNESS_INTEGRATION=1 but MySQL is unavailable');
    }
    if (mysqlAvailable) {
      fixtureId = resolveFixtureId(manifestPath);
    }
  });

  after(async () => {
    if (pool) await pool.end();
  });

  function skipUnlessReady(t) {
    if (!mysqlAvailable) {
      t.skip('MySQL not available (run npm run test:correctness with DB up)');
      return false;
    }
    return true;
  }

  test('clean run_id passes all invariant checks', async (t) => {
    if (!skipUnlessReady(t)) return;
    const runId = `correctness-clean-${randomUUID()}`;
    const result = await runCorrectnessChecks(pool, { runId, fixtureId });
    assert.equal(result.passed, true);
    assert.ok(result.checkCount >= 8);
    assert.equal(result.failures.length, 0);
  });

  test('inventory mismatch for run_id fails reconciliation', async (t) => {
    if (!skipUnlessReady(t)) return;

    const runId = `correctness-fail-${randomUUID()}`;
    const bookingId = randomUUID();
    const [userRows] = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = userRows[0]?.id;
    const [invRows] = await pool.query(
      `SELECT id FROM seat_inventory WHERE fixture_id = ? AND available_seats > 0 LIMIT 1`,
      [fixtureId],
    );
    const inventoryId = invRows[0]?.id;
    assert.ok(userId && inventoryId, 'fixture rows required');

    await pool.query(
      `INSERT INTO bookings (id, run_id, user_id, inventory_id, status, seat_count, total_fare, simulated_pnr)
       VALUES (?, ?, ?, ?, 'CONFIRMED', 3, 100.00, 'RF1111111111')`,
      [bookingId, runId, userId, inventoryId],
    );

    try {
      const result = await runCorrectnessChecks(pool, { runId, fixtureId });
      assert.equal(result.passed, false);
      assert.ok(
        result.failures.some((f) => f.id.includes('confirmed') || f.description.includes('confirmed')),
      );
    } finally {
      await pool.query(`DELETE FROM bookings WHERE id = ?`, [bookingId]);
    }
  });
});
