/**
 * Atomic inventory claim (M3 #20) — TC-004 sold-out path; requires MySQL + fixture.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { claimInventorySeats } from '../../services/baseline/dist/services/claim-inventory.js';
import { createPool, pingDatabase } from '../../services/baseline/dist/db.js';
import { TC001_INVENTORY_3A_ID } from '../helpers/tc001-fixture.mjs';

const requireMysql = process.env.CLAIM_INTEGRATION === '1';

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

describe('atomic inventory claim (integration)', () => {
  /** @type {import('../../services/baseline/dist/db.js').DbPool | undefined} */
  let pool;
  let mysqlAvailable = false;

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
      throw new Error('CLAIM_INTEGRATION=1 but MySQL is unavailable');
    }
  });

  after(async () => {
    if (pool) await pool.end();
  });

  function skipUnlessReady(t) {
    if (!mysqlAvailable) {
      t.skip('MySQL not available (run npm run test:claim-inventory with DB up)');
      return false;
    }
    return true;
  }

  test('successful claim decrements seats and bumps version (rolled back)', async (t) => {
    if (!skipUnlessReady(t)) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const before = await readInventory(conn, TC001_INVENTORY_3A_ID);
      assert.ok(before, 'fixture inventory row missing');

      const result = await claimInventorySeats(conn, {
        inventoryId: TC001_INVENTORY_3A_ID,
        seatCount: 1,
        expectedVersion: before.version,
      });
      assert.equal(result.ok, true);
      assert.equal(result.seatCount, 1);
      assert.equal(result.availableSeats, before.availableSeats - 1);
      assert.equal(result.version, before.version + 1);

      const after = await readInventory(conn, TC001_INVENTORY_3A_ID);
      assert.equal(after.availableSeats, before.availableSeats - 1);
      assert.equal(after.version, before.version + 1);
      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  test('TC-004: zero-row claim returns SOLD_OUT without negative inventory', async (t) => {
    if (!skipUnlessReady(t)) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const before = await readInventory(conn, TC001_INVENTORY_3A_ID);
      await conn.query(
        `UPDATE seat_inventory SET available_seats = 0 WHERE id = ?`,
        [TC001_INVENTORY_3A_ID],
      );

      const result = await claimInventorySeats(conn, {
        inventoryId: TC001_INVENTORY_3A_ID,
        seatCount: 1,
        expectedVersion: before.version,
      });
      assert.deepEqual(result, { ok: false, reason: 'SOLD_OUT' });

      const after = await readInventory(conn, TC001_INVENTORY_3A_ID);
      assert.equal(after.availableSeats, 0);
      assert.equal(after.version, before.version);

      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  test('stale version returns VERSION_CONFLICT without mutating row', async (t) => {
    if (!skipUnlessReady(t)) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const before = await readInventory(conn, TC001_INVENTORY_3A_ID);

      const result = await claimInventorySeats(conn, {
        inventoryId: TC001_INVENTORY_3A_ID,
        seatCount: 1,
        expectedVersion: before.version + 99,
      });
      assert.deepEqual(result, { ok: false, reason: 'VERSION_CONFLICT' });

      const after = await readInventory(conn, TC001_INVENTORY_3A_ID);
      assert.equal(after.availableSeats, before.availableSeats);
      assert.equal(after.version, before.version);
      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  test('claim more seats than available returns SOLD_OUT', async (t) => {
    if (!skipUnlessReady(t)) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const before = await readInventory(conn, TC001_INVENTORY_3A_ID);

      const result = await claimInventorySeats(conn, {
        inventoryId: TC001_INVENTORY_3A_ID,
        seatCount: 4,
        expectedVersion: before.version,
      });
      if (before.availableSeats >= 4) {
        assert.equal(result.ok, true);
      } else {
        assert.deepEqual(result, { ok: false, reason: 'SOLD_OUT' });
        const after = await readInventory(conn, TC001_INVENTORY_3A_ID);
        assert.equal(after.availableSeats, before.availableSeats);
        assert.equal(after.version, before.version);
      }
      await conn.rollback();
    } finally {
      conn.release();
    }
  });
});
