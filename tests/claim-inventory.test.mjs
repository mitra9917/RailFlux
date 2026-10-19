import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimInventorySeats } from '../services/baseline/dist/services/claim-inventory.js';

function mockDb(handlers) {
  return {
    async query(sql, params) {
      for (const handler of handlers) {
        const out = handler(String(sql), params);
        if (out !== undefined) return out;
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
}

test('claimInventorySeats rejects invalid seatCount', async () => {
  const db = mockDb([]);
  await assert.rejects(
    () => claimInventorySeats(db, { inventoryId: 'x', seatCount: 0, expectedVersion: 0 }),
    /seatCount must be an integer from 1 to 4/,
  );
});

test('claimInventorySeats returns success when update affects one row', async () => {
  const inventoryId = 'c0714d77-5e36-4aeb-a001-dd17aa3809c3';
  const db = mockDb([
    (sql) => {
      if (sql.includes('UPDATE seat_inventory')) {
        return [{ affectedRows: 1 }, undefined];
      }
      if (sql.includes('SELECT available_seats')) {
        return [[{ availableSeats: 499, version: 1 }], undefined];
      }
    },
  ]);

  const result = await claimInventorySeats(db, {
    inventoryId,
    seatCount: 1,
    expectedVersion: 0,
  });
  assert.deepEqual(result, {
    ok: true,
    inventoryId,
    seatCount: 1,
    availableSeats: 499,
    version: 1,
  });
});

test('claimInventorySeats returns SOLD_OUT when row exists but update matches zero rows', async () => {
  const inventoryId = 'inv-1';
  const db = mockDb([
    (sql) => {
      if (sql.includes('UPDATE seat_inventory')) {
        return [{ affectedRows: 0 }, undefined];
      }
      if (sql.includes('SELECT available_seats')) {
        return [[{ availableSeats: 0, version: 2 }], undefined];
      }
    },
  ]);

  const result = await claimInventorySeats(db, {
    inventoryId,
    seatCount: 1,
    expectedVersion: 2,
  });
  assert.deepEqual(result, { ok: false, reason: 'SOLD_OUT' });
});
